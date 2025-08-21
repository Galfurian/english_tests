from flask import Flask, render_template, request, jsonify, session
import json
import urllib.parse
import logging
import os

# Import functions and configurations from core.py
from core import get_new_text_and_blanks, generate_exercise_data

app = Flask(__name__)

# --- IMPORTANT ---
# Set a secret key for session management.
# In a production environment, this should be a strong, randomly generated key
# loaded from an environment variable or a secure configuration file.
app.secret_key = os.environ.get(
    "FLASK_SECRET_KEY", "a_very_secret_key_that_should_be_changed_in_production_12345"
)
# --- IMPORTANT ---


def _compute_min_max_blanks(
    slider_value: float,
    text_length: int,
    min_percentage: int,
    max_percentage: int,
):
    # Make sure the slider value is between 1 and 10, and offset to 0-9.
    slider_value = max(1.0, min(10.0, slider_value)) - 1.0
    # Map the slider value (0-9) to blank percentage.
    percentage = min_percentage
    percentage += (slider_value / 9.0) * (max_percentage - min_percentage)
    # Turn the percentage into a floating point value between 0.0 and 1.0.
    percentage = float(percentage) / 100.0
    # We'll use a heuristic of 5 characters per word for estimation.
    estimated_words = text_length / 5
    # Compute the minimum and maximum number of blanks.
    min_blanks = max(1, int(estimated_words * (percentage) * 0.8))
    max_blanks = max(min_blanks + 1, int(estimated_words * (percentage) * 1.2))
    return min_blanks, max_blanks


def _process_get_request():
    # Check if exercise data exists in the session
    if "original_full_text" in session and "blanks_data" in session:
        logging.info("Retrieving exercise from session.")
        display_parts = session.get("display_parts")
        blanks_data = session.get("blanks_data")
        word_bank = session.get("word_bank")
        original_full_text = session.get("original_full_text")
    else:
        logging.info("No exercise in session. Rendering empty page.")
        # Render with empty data if no exercise is in session
        display_parts = []
        blanks_data = {}
        word_bank = []
        original_full_text = ""

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

    # Retrieve correct answers and original text from session
    correct_answers = session.get("blanks_data", {})
    original_full_text = session.get("original_full_text", "")
    display_parts = session.get("display_parts", []) # Get display parts from session

    results = {}
    score = 0
    total_blanks = 0 # Initialize total_blanks here

    # Iterate through display_parts to ensure results are built for every blank shown
    for part in display_parts:
        if part.startswith("BLANK_"):
            original_index = int(part.split("_")[1])
            total_blanks += 1 # Count total blanks from display_parts

            correct_word = correct_answers.get(original_index, "[MISSING]") # Use .get() for safety
            user_word = user_answers.get(original_index, "")
            is_correct = user_word == correct_word

            results[original_index] = {
                "user": user_word,
                "correct": correct_word,
                "is_correct": is_correct,
            }
            if is_correct:
                score += 1

    logging.info(f"Final results dictionary: {results}") # Add this log

    return render_template(
        "index.html",
        display_parts=display_parts, # Pass display_parts from session
        word_bank=[], # Word bank is not needed on results page
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


# New endpoint for re-blanking
@app.route("/reblank", methods=["POST"])
def reblank():
    # Get the request data.
    data = request.get_json()
    # Get the original text.
    original_text = data.get("original_text")
    # Get the slider value.
    slider_value = int(data.get("slider_value", 5))
    # Compute the minimum and maximum number of blanks.
    min_blanks, max_blanks = _compute_min_max_blanks(
        slider_value,
        len(original_text),
        5,
        25,
    )
    # Generate exercise data.
    display_parts, blanks_data, word_bank = generate_exercise_data(
        original_text,
        min_blanks,
        max_blanks,
    )
    # Update session with new blank data
    session["display_parts"] = display_parts
    session["blanks_data"] = blanks_data
    session["word_bank"] = word_bank
    session["original_full_text"] = (
        original_text  # Ensure original text is also in session
    )

    return jsonify(
        {
            "display_parts": display_parts,
            "blanks_data": blanks_data,
            "word_bank": word_bank,
        }
    )


@app.route("/generate_new_text", methods=["POST"])
def generate_new_text_route():
    # Get the request data.
    data = request.get_json()
    # Get text_length from request
    text_length = int(data.get("text_length", 250))
    # Get the slider value.
    slider_value = int(data.get("slider_value", 5))
    # Compute the minimum and maximum number of blanks.
    min_blanks, max_blanks = _compute_min_max_blanks(
        slider_value,
        text_length,
        5,
        25,
    )
    # Generate new text and blanks.
    display_parts, blanks_data, word_bank, original_full_text = get_new_text_and_blanks(
        min_blanks=min_blanks,
        max_blanks=max_blanks,
        text_length=text_length,
    )
    # Update session with new text and blank data.
    session["display_parts"] = display_parts
    session["blanks_data"] = blanks_data
    session["word_bank"] = word_bank
    session["original_full_text"] = original_full_text

    return jsonify(
        {
            "display_parts": display_parts,
            "blanks_data": blanks_data,
            "word_bank": word_bank,
            "original_full_text": original_full_text,
        }
    )
