from flask import Flask, render_template, request
from transformers import pipeline
import random
import json
import urllib.parse
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)-7s] - %(message)s"
)

app = Flask(__name__)

# Configuration for blank generation
BLANK_COUNT_RANGE = (3, 5)  # (min_blanks, max_blanks)
TEXT_LENGTH = 50  # Max new tokens for generated text
USE_LLM_GENERATION = False  # Set to False to use a standard text for debugging
FALLBACK_TEXT = (
    "This is a standard text for debugging purposes. "
    "Basically, it provides a consistent base for testing, the blanks generation, and checking logic. "
    "You can modify this text in the code."
)

# Load the DistilGPT2 model
# This will download the model the first time it's run
generator = pipeline("text-generation", model="gpt2-medium")

# --- Helper Functions ---


def _generate_raw_text(initial_prompt: str, generator, text_length: int) -> str:
    """Generates text using the LLM and handles prompt removal/stripping."""
    for _ in range(5):  # Try up to 5 times to get a good text
        generated_sequences = generator(
            initial_prompt,
            max_new_tokens=text_length,
            truncation=True,
            num_return_sequences=3,
            do_sample=True,
            temperature=0.8,
            top_k=50,
            top_p=0.95,
        )
        generated_text = generated_sequences[0]["generated_text"]

        if generated_text.startswith(initial_prompt):
            generated_text = generated_text[len(initial_prompt) :].strip()
        else:
            generated_text = generated_text.strip()

        words = generated_text.split()
        # Ensure text is long enough for meaningful blank selection
        if len(words) >= 15:  # Increased minimum length for raw text
            return generated_text
    return ""  # Return empty string if no suitable text is generated after tries


def _select_blanks(words: list[str], min_offset: int, num_blanks_range: tuple) -> dict:
    """Selects words to be turned into blanks, returning {index: original_word}."""
    if len(words) < min_offset + 1:
        logging.warning(
            f"Not enough words ({len(words)}) to select blanks with offset {min_offset}."
        )
        return {}  # Not enough words to select blanks with offset

    population_for_blanks = list(enumerate(words))[min_offset:]
    if not population_for_blanks:  # Ensure population is not empty
        logging.warning(f"Population for blanks is empty after offset {min_offset}.")
        return {}

    max_possible_blanks = max(1, len(population_for_blanks) // 2)
    num_blanks = random.randint(
        min(num_blanks_range[0], max_possible_blanks),
        min(num_blanks_range[1], max_possible_blanks),
    )
    if num_blanks == 0 and max_possible_blanks > 0:
        num_blanks = 1

    blanks_data = {}
    selected_indices = set()
    available_indices = [idx for idx, _ in population_for_blanks]
    
    # Try to select non-adjacent blanks
    for _ in range(num_blanks):
        if not available_indices:
            logging.warning("Not enough non-adjacent words to select all blanks.")
            break
        
        chosen_idx_in_population = random.choice(available_indices)
        original_idx = population_for_blanks[available_indices.index(chosen_idx_in_population)][0]
        
        selected_indices.add(original_idx)
        blanks_data[original_idx] = words[original_idx].strip('.,!?;:').lower()
        
        # Remove chosen index and its neighbors from available_indices
        available_indices = [idx for idx in available_indices if idx != original_idx and idx != original_idx - 1 and idx != original_idx + 1]

    if not blanks_data and population_for_blanks: # Fallback if no blanks could be selected non-adjacently
        logging.warning("Could not select non-adjacent blanks, falling back to random selection.")
        # Fallback to original random.sample if non-adjacent selection fails
        words_to_remove_from_population = random.sample(population_for_blanks, num_blanks)
        words_to_remove_from_population.sort(key=lambda x: x[0])
        for idx, word in words_to_remove_from_population:
            blanks_data[idx] = word.strip('.,!?;:').lower()

    return blanks_data


def _create_display_parts(words: list[str], blanks_data: dict) -> list[str]:
    """Creates the list of display parts (words or BLANK_X placeholders)."""
    display_parts = []
    for i, word in enumerate(words):
        if i in blanks_data:
            word_part, punctuation_part = _split_word_and_punctuation(word)
            display_parts.append(f"BLANK_{i}")
            if punctuation_part:
                display_parts.append(punctuation_part)
        else:
            display_parts.append(word)
    return display_parts

def _split_word_and_punctuation(word: str) -> tuple[str, str]:
    """Splits a word into its word part and trailing punctuation part."""
    punctuation = '.,!?;:'
    word_part = word
    punctuation_part = ''
    
    # Iterate from the end to find trailing punctuation
    for i in range(len(word) - 1, -1, -1):
        if word[i] in punctuation:
            punctuation_part = word[i] + punctuation_part
            word_part = word[:i]
        else:
            break
    return word_part, punctuation_part


def generate_exercise_text(
    num_blanks_range: tuple = (3, 5), text_length: int = 150
) -> tuple:
    """Generates a paragraph and creates blanks."""
    min_words_for_blanks = (
        10  # Require at least 10 words before starting to pick blanks
    )
    initial_prompt = (
        "Write a short, engaging paragraph about a common everyday topic, "
        "such as a morning routine, a visit to a park, or cooking a simple meal. "
        "Ensure the language is clear and suitable for an English learner. "
        "The paragraph should be coherent and flow naturally. "
    )

    if USE_LLM_GENERATION:
        generated_text = _generate_raw_text(initial_prompt, generator, text_length)
        if not generated_text:  # If raw text generation failed
            logging.error(
                "Failed to generate suitable raw text after multiple attempts."
            )
            # Fallback to a standard text if LLM generation fails
            generated_text = FALLBACK_TEXT
    else:
        generated_text = FALLBACK_TEXT

    words = generated_text.split()

    blanks_data = _select_blanks(words, min_words_for_blanks, num_blanks_range)
    if not blanks_data:  # If blank selection failed (e.g., text too short after offset)
        return (
            ["This", "is", "another", "fallback", "text.", "BLANK_4"],
            {4: "fallback"},
            ["fallback"],
            "This is another fallback text. fallback",
        )

    display_parts = _create_display_parts(words, blanks_data)

    word_bank = [blanks_data[idx] for idx in blanks_data.keys()]
    random.shuffle(word_bank)

    return (
        display_parts,
        blanks_data,
        word_bank,
        generated_text,
    )


def _process_get_request():
    display_parts, blanks_data, word_bank, original_full_text = generate_exercise_text(
        num_blanks_range=BLANK_COUNT_RANGE, text_length=TEXT_LENGTH
    )
    correct_answers_json = json.dumps(blanks_data)
    return render_template(
        "index.html",
        display_parts=display_parts,
        word_bank=word_bank,
        correct_answers_json=correct_answers_json,
        original_full_text=original_full_text,
    )


def _process_post_request():
    user_answers = {}
    for key, value in request.form.items():
        if key.startswith("BLANK_"):
            index = int(key.split("_")[1])
            user_answers[index] = value.strip().lower()

    correct_answers_json = request.form.get("correct_answers_json")
    original_full_text = request.form.get("original_full_text")
    display_parts_str = request.form.get("display_parts_str")

    try:
        correct_answers = json.loads(correct_answers_json)
        correct_answers = {int(k): v for k, v in correct_answers.items()}
    except json.JSONDecodeError as e:
        logging.error(
            f"JSONDecodeError for correct_answers_json: {e} - Data: {correct_answers_json}"
        )
        return (
            render_template(
                "error.html", message="Error processing correct answers data."
            ),
            500,
        )  # Return an error to the user

    try:
        display_parts = json.loads(urllib.parse.unquote(display_parts_str))
    except json.JSONDecodeError as e:
        logging.error(
            f"JSONDecodeError for display_parts_str: {e} - Data: {display_parts_str}"
        )
        return (
            render_template(
                "error.html", message="Error processing display parts data."
            ),
            500,
        )  # Return an error to the user

    results = {}
    score = 0
    total_blanks = len(correct_answers)

    for index, correct_word in correct_answers.items():
        user_word = user_answers.get(index, "")
        is_correct = user_word == correct_word
        results[index] = {
            "user": user_word,
            "correct": correct_word,
            "is_correct": is_correct,
        }
        if is_correct:
            score += 1

    return render_template(
        "index.html",
        display_parts=display_parts,
        word_bank=[],
        results=results,
        score=score,
        total_blanks=total_blanks,
        original_full_text=original_full_text,
    )


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        return _process_post_request()
    else:
        return _process_get_request()


if __name__ == "__main__":
    app.run(debug=True)  # debug=True allows auto-reloading and shows errors
