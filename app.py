from flask import Flask, render_template, request
from transformers import pipeline
import random
import json
import urllib.parse

app = Flask(__name__)

# Load the DistilGPT2 model
# This will download the model the first time it's run
generator = pipeline("text-generation", model="gpt2-medium")

# --- Helper Functions ---


def generate_exercise_text() -> tuple:
    """Generates a paragraph and creates blanks."""
    min_words_for_blanks = 10 # Require at least 10 words before starting to pick blanks
    # Provide a more descriptive and longer initial prompt
    initial_prompt = (
        "Write a short, engaging paragraph about a common everyday topic, "
        "such as a morning routine, a visit to a park, or cooking a simple meal. "
        "Ensure the language is clear and suitable for an English learner. "
        "The paragraph should be coherent and flow naturally. "
    )

    # Generate multiple sequences and pick one for better quality
    # Loop to ensure we get a sufficiently long and useful text
    for _ in range(5): # Try up to 5 times to get a good text
        generated_sequences = generator(
            initial_prompt,
            max_new_tokens=150,  # Increased length for more content
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

        # Check if the text is long enough and has enough words after the initial offset
        if len(words) >= min_words_for_blanks + 5: # Ensure at least 5 words after the offset
            break
    else:
        # If after 5 tries, we still don't have a good text, return a fallback
        return (
            ["This", "is", "a", "fallback", "text.", "BLANK_4"],
            {4: "fallback"},
            ["fallback"],
            "This is a fallback text. fallback",
        )

    # For simplicity, pick the first generated sequence.
    # In a more advanced setup, you might have criteria to choose the best one.
    generated_text = generated_sequences[0]["generated_text"]

    # Remove the initial prompt from the generated text if it's included by the model
    # Also aggressively strip any leading/trailing whitespace or newlines
    if generated_text.startswith(initial_prompt):
        generated_text = generated_text[len(initial_prompt):].strip()
    else:
        generated_text = generated_text.strip() # Just strip if prompt wasn't at the very beginning

    words = generated_text.split()

    # Ensure there are enough words to create blanks and avoid blanks at the very beginning
    min_words_for_blanks = 10 # Require at least 10 words before starting to pick blanks
    if len(words) < min_words_for_blanks + 1: # +1 because we need at least one word after the min_words_for_blanks
        # If text is too short, try generating again or return an error
        # For now, let's just return a very simple text to avoid recursion
        return "This is a short text. ____", {0: "short"}, ["short"], "This is a short text. short"

    # Define the population from which to sample words for blanks
    # Exclude the first few words to avoid blanks at the very beginning
    population_for_blanks = list(enumerate(words))[min_words_for_blanks:]

    # Simple blank creation: remove 3-5 random words, but not more than half the words
    max_possible_blanks = max(1, len(population_for_blanks) // 2) # At least 1 blank, max half the words
    num_blanks = random.randint(min(3, max_possible_blanks), min(5, max_possible_blanks))
    
    # Ensure num_blanks is not zero if max_possible_blanks is very small
    if num_blanks == 0 and max_possible_blanks > 0:
        num_blanks = 1

    words_to_remove_from_population = random.sample(population_for_blanks, num_blanks)
    words_to_remove_from_population.sort(key=lambda x: x[0]) # Keep original order

    blanks_data = {} # {original_index: original_word}
    display_parts = []
    blank_counter = 0

    for i, word in enumerate(words):
        # Check if the current word's original index is in the list of words to remove
        if any(idx == i for idx, _ in words_to_remove_from_population):
            blanks_data[i] = word.strip('.,!?;:').lower() # Store clean word
            display_parts.append(f"BLANK_{i}") # Use a unique placeholder for the template
        else:
            display_parts.append(word)

    # Prepare words for the word bank (shuffled)
    word_bank = [blanks_data[idx] for idx, _ in words_to_remove_from_population]
    random.shuffle(word_bank)

    # Return original text for checking
    return (
        display_parts,
        blanks_data,
        word_bank,
        generated_text,
    )


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        user_answers = {}
        for key, value in request.form.items():
            if key.startswith("BLANK_"):
                index = int(key.split("_")[1])
                user_answers[index] = value.strip().lower()

        # Retrieve the correct answers and original text from hidden fields
        correct_answers_json = request.form.get('correct_answers_json')
        original_full_text = request.form.get('original_full_text')
        display_parts_str = request.form.get('display_parts_str')

        # Reconstruct correct_answers dictionary from JSON
        correct_answers = json.loads(correct_answers_json)
        # Convert keys back to int as JSON keys are strings
        correct_answers = {int(k): v for k, v in correct_answers.items()}

        # Reconstruct display_parts list
        display_parts = json.loads(urllib.parse.unquote(display_parts_str))

        results = {}
        score = 0
        total_blanks = len(correct_answers)

        for index, correct_word in correct_answers.items():
            user_word = user_answers.get(index, '')
            is_correct = (user_word == correct_word)
            results[index] = {'user': user_word, 'correct': correct_word, 'is_correct': is_correct}
            if is_correct:
                score += 1

        return render_template('index.html',
                               display_parts=display_parts,
                               word_bank=[], # No word bank on results page
                               results=results,
                               score=score,
                               total_blanks=total_blanks,
                               original_full_text=original_full_text)

    else:  # GET request
        display_parts, blanks_data, word_bank, original_full_text = (
            generate_exercise_text()
        )
        # Convert blanks_data dict to a JSON string for passing to template
        correct_answers_json = json.dumps(blanks_data)
        return render_template(
            "index.html",
            display_parts=display_parts,
            word_bank=word_bank,
            correct_answers_json=correct_answers_json,
            original_full_text=original_full_text,
        )


if __name__ == "__main__":
    app.run(debug=True)  # debug=True allows auto-reloading and shows errors
