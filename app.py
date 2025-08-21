from math import log
from flask import Flask, render_template, request
from transformers import pipeline
import random
import json
import urllib.parse
import logging
import re

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)-7s] - %(message)s"
)

app = Flask(__name__)

# Configuration for blank generation (min_blanks, max_blanks)
BLANK_COUNT_RANGE = (3, 5)
# Max new tokens for generated text.
TEXT_LENGTH = 50
# Set to False to use a standard text for debugging.
USE_LLM_GENERATION = True
# Fallback text for debugging purposes.
FALLBACK_TEXT = (
    "This is a standard text for debugging purposes. "
    "Basically, it provides a consistent base for testing, the blanks generation, and checking logic. "
    "You can modify this text in the code."
)
# Prompt for the LLM to generate text.
LLM_PROMPT = "Write a short, engaging paragraph about your morning routine, or a visit to a park, or cooking a simple meal."

# Load the DistilGPT2 model
# This will download the model the first time it's run
generator = pipeline("text-generation", model="gpt2-medium")

# --- Helper Functions ---


def _generate_raw_text(initial_prompt: str, generator, text_length: int) -> str:
    """Generates text using the LLM and handles prompt removal/stripping."""
    # Try up to 5 times to get a good text.
    for attempt in range(5):
        logging.info("Generating text with LLM, attempt %d", attempt + 1)
        generated_sequences = generator(
            initial_prompt,
            max_new_tokens=text_length,
            truncation=False,
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
        if len(words) >= 15:
            # Cut at the first period from the end to ensure complete sentences
            last_period_index = generated_text.rfind(".")
            if last_period_index != -1:
                generated_text = generated_text[: last_period_index + 1]
                words = generated_text.split()  # Re-split words after cutting
            return generated_text
    logging.warning(
        "Failed to generate suitable text after multiple attempts. "
        "Returning an empty string."
    )
    # Return empty string if no suitable text is generated after tries.
    return ""


def _select_blanks(words: list[str], num_blanks_range: tuple) -> dict:
    """Selects words to be turned into blanks, returning {index: original_word}."""
    # Check if the words list is empty or too short.
    population_for_blanks = _get_blank_selection_population(words)
    if not population_for_blanks:
        logging.warning("No words available for blank selection.")
        return {}

    # Determine the number of blanks to select.
    num_blanks = _determine_num_blanks(len(population_for_blanks), num_blanks_range)
    if num_blanks == 0:
        logging.warning("No blanks to select based on the population size.")
        return {}

    blanks_data = _select_non_adjacent_blanks(population_for_blanks, num_blanks)
    # If non-adjacent selection failed to get enough blanks
    if len(blanks_data) < num_blanks:
        logging.warning(
            "Could not select enough non-adjacent blanks,"
            "falling back to random selection."
        )
        blanks_data = _select_random_blanks(population_for_blanks, num_blanks)

    return blanks_data


def _get_blank_selection_population(words: list[str]) -> list[tuple[int, str]]:
    """Extracts the initial population of words for blank selection."""
    return list(enumerate(words))


def _determine_num_blanks(population_size: int, num_blanks_range: tuple) -> int:
    """Calculates the actual number of blanks to select."""
    # Ge the maximum possible blanks based on population size.
    max_possible_blanks = max(1, population_size // 2)

    # Ensure the range is within the bounds of the population size.
    num_blanks = random.randint(
        min(num_blanks_range[0], max_possible_blanks),
        min(num_blanks_range[1], max_possible_blanks),
    )

    # Ensure at least one blank is selected if possible.
    if num_blanks == 0 and max_possible_blanks > 0:
        num_blanks = 1
    return num_blanks


def _select_non_adjacent_blanks(
    population: list[tuple[int, str]], num_blanks: int
) -> dict:
    """Selects non-adjacent blanks from the population."""
    blanks_data = {}
    selected_indices = set()
    available_population = list(population)

    for _ in range(num_blanks):
        if not available_population:
            logging.warning(
                "Not enough words in population to select all non-adjacent blanks."
            )
            break

        # Select a random word from the available population
        chosen_item = random.choice(available_population)
        original_idx, original_word = chosen_item

        # Add to blanks_data
        blanks_data[original_idx] = original_word.strip(".,!?;:'\"")
        selected_indices.add(original_idx)

        # Remove chosen item and its neighbors from available_population
        new_available_population = []
        for idx, word in available_population:
            if (
                idx != original_idx
                and idx != original_idx - 1
                and idx != original_idx + 1
            ):
                new_available_population.append((idx, word))
        available_population = new_available_population

    return blanks_data


def _select_random_blanks(population: list[tuple[int, str]], num_blanks: int) -> dict:
    """Selects random blanks from the population (fallback)."""
    # Get a random sample of words from the population.
    words_to_remove_from_population = random.sample(population, num_blanks)
    # Sort by index to maintain order in the final output.
    words_to_remove_from_population.sort(key=lambda x: x[0])
    # Create a dictionary with the index as key and the word as value.
    blanks_data = {}
    for idx, word in words_to_remove_from_population:
        blanks_data[idx] = word.strip(".,!?;:'\"")
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
    punctuation = ".,!?;:"
    word_part = word
    punctuation_part = ""

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
    """Generates the exercise text with blanks and a word bank.

    Args:
        num_blanks_range (tuple, optional):
            Range of number of blanks to select (min_blanks, max_blanks).
            Defaults to (3, 5).
        text_length (int, optional):
            Maximum length of the generated text in new tokens.
            Defaults to 150.

    Returns:
        tuple: A tuple containing:
            - display_parts (list): List of words and BLANK placeholders.
            - blanks_data (dict): Dictionary mapping blank indices to original words.
            - word_bank (list): List of words to fill the blanks.
            - generated_text (str): The original text used for the exercise.
    """
    # If LLM generation is enabled, generate text using the model.
    if USE_LLM_GENERATION:
        generated_text = _generate_raw_text(LLM_PROMPT, generator, text_length)
        if not generated_text:
            logging.error("Using fallback text due to empty generated text.")
            generated_text = FALLBACK_TEXT
    else:
        generated_text = FALLBACK_TEXT
    # Split the generated text into words.
    words = generated_text.split()
    # Select blanks from the generated text.
    blanks_data = _select_blanks(words, num_blanks_range)
    # If blank selection failed (e.g., text too short after offset)
    if not blanks_data:
        return (
            ["This", "is", "another", "fallback", "text.", "BLANK_4"],
            {4: "fallback"},
            ["fallback"],
            "This is another fallback text. fallback",
        )
    # Create display parts with BLANK placeholders.
    display_parts = _create_display_parts(words, blanks_data)
    # Create a word bank from the blanks data.
    word_bank = [blanks_data[idx] for idx in blanks_data.keys()]
    # Shuffle the word bank for randomness.
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
