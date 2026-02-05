import dis
from flask import Flask, render_template, request, jsonify, session
import json
import urllib.parse
import logging
import os

# Import functions and configurations from core.py
from .core import (
    get_exercise_with_percentage_blanks,
    create_exercise_with_blanks_percentage,
)

app = Flask(__name__)

# --- IMPORTANT ---
# Set a secret key for session management.
# In a production environment, this should be a strong, randomly generated key
# loaded from an environment variable or a secure configuration file.
app.secret_key = os.environ.get(
    "FLASK_SECRET_KEY", "a_very_secret_key_that_should_be_changed_in_production_12345"
)
# --- IMPORTANT ---

# =============================================================================
# GET FUNCTIONS
# =============================================================================


def _get_data_bool(data: dict, key: str) -> bool:
    """
    Safely retrieves a boolean from session data with proper type checking.

    Args:
        data: The JSON data from the request
        key: The key to retrieve from the data

    Returns:
        bool: The value associated with the key, or False if not found or invalid
    """
    value = data.get(key, False)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        value_lower = value.strip().lower()
        if value_lower in {"true", "1", "yes"}:
            return True
        elif value_lower in {"false", "0", "no"}:
            return False
    return False


def _get_data_str(data: dict, key: str) -> str | None:
    """
    Safely retrieves a string from session data with proper type checking.

    Args:
        data: The JSON data from the request
        key: The key to retrieve from the data

    Returns:
        str: The value associated with the key, or None if not found or invalid
    """
    value = data.get(key, None)
    if isinstance(value, str):
        value = value.strip()
        if value:
            return value
    return None


def _get_data_slider(data: dict, key: str, min_val: int = 1, max_val: int = 10) -> int:
    """
    Safely retrieves a slider value from session data with proper type checking.

    Args:
        data: The JSON data from the request
        key: The key to retrieve from the data

    Returns:
        int: The slider value, clamped between 1 and 10, or default 5 if invalid
    """
    value = data.get(key, 5)
    try:
        value = int(value)
        if value < min_val or value > max_val:
            logging.warning("Slider value %d out of range, clamping", value)
            value = max(min_val, min(max_val, value))
    except (ValueError, TypeError):
        logging.warning("Invalid value, using default: %s", value)
        # Default to midpoint if invalid.
        value = (min_val + max_val) // 2
    return value


def _get_user_answers(form) -> dict[int, str]:
    """Extracts user answers from form data."""
    if not form:
        logging.warning("Empty form provided to _get_user_answers")
        return {}

    try:
        user_answers: dict[int, str] = {}
        for key, value in form.items():
            if not isinstance(key, str):
                logging.warning("Non-string key in form: %s", repr(key))
                continue

            if key.startswith("BLANK_"):
                try:
                    index_str = key.split("_")[1]
                    index = int(index_str)

                    if not isinstance(value, str):
                        logging.warning(
                            "Non-string value for key %s: %s", key, repr(value)
                        )
                        value = str(value)

                    user_answers[index] = value.strip().lower()

                except (IndexError, ValueError) as e:
                    logging.error("Error parsing form key '%s': %s", key, e)
                    continue
                except Exception as e:
                    logging.error(
                        "Unexpected error processing form key '%s': %s", key, e
                    )
                    continue

        logging.debug("Extracted %d user answers from form", len(user_answers))
        return user_answers

    except Exception as e:
        logging.error("Unexpected error in _get_user_answers: %s", e)
        return {}


# =============================================================================
# SUPPORT FUNCTIONS
# =============================================================================


def _evaluate_answers(
    user_answers: dict[int, str], blanks_data: dict[int, str], display_parts: list[str]
) -> tuple[dict, int, int]:
    """Evaluates user answers against correct answers."""
    # Input validation
    if not isinstance(user_answers, dict):
        logging.error("Invalid user_answers type: %s", type(user_answers))
        user_answers = {}

    if not isinstance(blanks_data, dict):
        logging.error("Invalid blanks_data type: %s", type(blanks_data))
        return {}, 0, 0

    if not isinstance(display_parts, list):
        logging.error("Invalid display_parts type: %s", type(display_parts))
        return {}, 0, 0

    try:
        results = {}
        score = 0
        total_blanks = 0

        # Make sure the index is a key.
        correct_answers: dict[int, str] = {}
        for index, word in blanks_data.items():
            try:
                key_int = int(index) if not isinstance(index, int) else index
                value_str = str(word) if not isinstance(word, str) else word
                correct_answers[key_int] = value_str
            except (ValueError, TypeError) as e:
                logging.warning("Invalid blanks_data item (%s: %s): %s", index, word, e)
                continue

        logging.info("Processing user answers...")

        for part in display_parts:
            if not isinstance(part, str):
                logging.warning("Non-string display part: %s", repr(part))
                continue

            if not part.startswith("BLANK_"):
                continue

            try:
                original_index = int(part.split("_")[1])
            except (IndexError, ValueError) as e:
                logging.error("Error parsing display part '%s': %s", part, e)
                continue

            total_blanks += 1

            if original_index not in correct_answers:
                logging.warning(
                    "Original index %d not found in correct answers. Skipping.",
                    original_index,
                )
                continue

            correct_word = correct_answers.get(original_index, "[MISSING]")
            user_word = user_answers.get(original_index, "")

            # Ensure both are strings for comparison
            try:
                correct_word_str = str(correct_word).lower().strip()
                user_word_str = str(user_word).lower().strip()
                is_correct = user_word_str == correct_word_str
            except Exception as e:
                logging.error(
                    "Error comparing words for index %d: %s", original_index, e
                )
                is_correct = False

            results[original_index] = {
                "user": str(user_word),
                "correct": str(correct_word),
                "is_correct": is_correct,
            }
            if is_correct:
                score += 1

        logging.info("Evaluation complete: score %d/%d", score, total_blanks)
        logging.debug("Results: %s", results)
        return results, score, total_blanks

    except Exception as e:
        logging.error("Unexpected error in _evaluate_answers: %s", e)
        return {}, 0, 0


# =============================================================================
# PROCESSING FUNCTIONS
# =============================================================================


def _process_get_request():
    """Processes GET requests for the main index page."""
    try:
        # Check if exercise data exists in the session
        if "original_full_text" in session and "blanks_data" in session:
            logging.info("Retrieving exercise from session.")
            try:
                display_parts = session.get("display_parts", [])
                blanks_data = session.get("blanks_data", {})
                word_bank = session.get("word_bank", [])
                original_full_text = session.get("original_full_text", "")
                exercise_title = session.get("exercise_title", "")

                # Validate session data
                if not isinstance(display_parts, list):
                    logging.warning("Invalid display_parts in session, resetting")
                    display_parts = []
                if not isinstance(blanks_data, dict):
                    logging.warning("Invalid blanks_data in session, resetting")
                    blanks_data = {}
                if not isinstance(word_bank, list):
                    logging.warning("Invalid word_bank in session, resetting")
                    word_bank = []
                if not isinstance(original_full_text, str):
                    logging.warning("Invalid original_full_text in session, resetting")
                    original_full_text = ""
                if not isinstance(exercise_title, str):
                    logging.warning("Invalid exercise_title in session, resetting")
                    exercise_title = ""

            except Exception as e:
                logging.error("Error retrieving session data: %s", e)
                display_parts = []
                blanks_data = {}
                word_bank = []
                original_full_text = ""
                exercise_title = ""
        else:
            logging.info("No exercise in session. Rendering empty page.")
            # Render with empty data if no exercise is in session
            display_parts = []
            blanks_data = {}
            word_bank = []
            original_full_text = ""
            exercise_title = ""

        try:
            correct_answers_json = json.dumps(blanks_data)
        except (TypeError, ValueError) as e:
            logging.error("Error serializing blanks_data to JSON: %s", e)
            correct_answers_json = "{}"

        return render_template(
            "index.html",
            display_parts=display_parts,
            word_bank=word_bank,
            correct_answers_json=correct_answers_json,
            exercise_title=exercise_title,
            original_full_text=original_full_text,
        )

    except Exception as e:
        logging.error("Unexpected error in _process_get_request: %s", e)
        return (
            render_template(
                "error.html", error="An error occurred while loading the page."
            ),
            500,
        )


def _process_post_request():
    """Processes POST requests for answer submission."""
    try:
        if not request.form:
            logging.warning("Empty form submitted")
            return (
                render_template("error.html", error="No answers were submitted."),
                400,
            )

        # Extract user answers from the form.
        user_answers = _get_user_answers(request.form)

        # Validate and extract original_full_text from session data.
        original_full_text = session.get("original_full_text", None)
        if not original_full_text:
            logging.error("Invalid or missing original_full_text in session")
            return jsonify({"error": "Invalid or missing original_full_text"}), 400

        # Validate and extract word_bank from session data.
        word_bank = session.get("word_bank", None)
        if not word_bank:
            logging.error("Invalid or missing word_bank in session")
            return jsonify({"error": "Invalid or missing word_bank"}), 400

        # Validate and extract exercise_title from session data.
        exercise_title = session.get("exercise_title", None)
        if not exercise_title:
            logging.error("Invalid or missing exercise_title in session")
            return jsonify({"error": "Invalid or missing exercise_title"}), 400

        # Validate and extract display_parts and blanks_data from session.
        display_parts = session.get("display_parts", None)
        if not display_parts:
            logging.error("Invalid or missing display_parts in session")
            return jsonify({"error": "Invalid or missing display_parts"}), 400

        # Validate and extract blanks_data from session.
        blanks_data = session.get("blanks_data", None)
        if not isinstance(blanks_data, dict):
            logging.error("Invalid blanks_data type in session: %s", type(blanks_data))
            return jsonify({"error": "Invalid or missing blanks_data"}), 400

        results, score, total_blanks = _evaluate_answers(
            user_answers, blanks_data, display_parts
        )

        return render_template(
            "index.html",
            display_parts=display_parts,
            word_bank=word_bank,
            results=results,
            score=score,
            total_blanks=total_blanks,
            exercise_title=exercise_title,
            original_full_text=original_full_text,
        )

    except Exception as e:
        logging.error("Unexpected error in _process_post_request: %s", e)
        return (
            render_template(
                "error.html", error="An error occurred while processing your answers."
            ),
            500,
        )


# =============================================================================
# WEB ROUTES
# =============================================================================


# Global error handlers
@app.errorhandler(404)
def not_found_error(error):
    logging.warning("404 error: %s", request.url)
    return render_template("error.html", error="Page not found."), 404


@app.errorhandler(500)
def internal_error(error):
    logging.error("500 error: %s", error)
    return (
        render_template("error.html", error="An internal server error occurred."),
        500,
    )


@app.errorhandler(Exception)
def handle_exception(error):
    logging.error("Unhandled exception: %s", error, exc_info=True)
    return render_template("error.html", error="An unexpected error occurred."), 500


@app.route("/", methods=["GET", "POST"])
def index():
    """Main route handler for the application."""
    try:
        if request.method == "POST":
            return _process_post_request()
        else:
            return _process_get_request()
    except Exception as e:
        logging.error("Unexpected error in index route: %s", e)
        return render_template("error.html", error="An unexpected error occurred."), 500


# New endpoint for re-blanking
@app.route("/reblank", methods=["POST"])
def reblank():
    """Endpoint for regenerating blanks with existing text."""
    try:
        if not request.is_json:
            logging.error("Non-JSON request received at /reblank")
            return jsonify({"error": "Content-Type must be application/json"}), 400

        # Get the request data.
        data = request.get_json()
        if not data:
            logging.error("Empty JSON data received at /reblank")
            return jsonify({"error": "No data provided"}), 400

        # Validate and extract original_full_text from session data.
        original_full_text = session.get("original_full_text", None)
        if not original_full_text:
            logging.error("Invalid or missing original_full_text in /reblank")
            return jsonify({"error": "Invalid or missing original_full_text"}), 400

        # Validate and extract exercise_title from session data.
        exercise_title = session.get("exercise_title", None)
        if not exercise_title:
            logging.error("Invalid or missing exercise_title in /reblank")
            return jsonify({"error": "Invalid or missing exercise_title"}), 400

        # Validate and extract exercise_difficulty from session data.
        exercise_difficulty = _get_data_str(data, "exercise_difficulty")
        if not exercise_difficulty:
            logging.error("Invalid or missing exercise_difficulty in /reblank")
            return jsonify({"error": "Invalid or missing exercise_difficulty"}), 400

        # Validate and extract slider_value from session data.
        slider_value = _get_data_slider(data, "slider_value")
        if not slider_value:
            logging.error("Invalid or missing slider_value in /reblank")
            return jsonify({"error": "Invalid or missing slider_value"}), 400

        # Validate and extract include_random_words from session data.
        include_random_words = _get_data_bool(data, "include_random_words")
        if include_random_words is None:
            logging.error("Invalid or missing include_random_words in /reblank")
            return jsonify({"error": "Invalid or missing include_random_words"}), 400

        # Generate exercise data using percentage-based approach.
        display_parts, blanks_data, word_bank = create_exercise_with_blanks_percentage(
            original_full_text,
            slider_value,
            include_random_words,
        )

        if not display_parts or not blanks_data or not word_bank:
            logging.error("Failed to generate exercise data for reblank")
            return jsonify({"error": "Failed to generate exercise data"}), 500

        # Update session with new blank data (preserve existing title)
        try:
            session["display_parts"] = display_parts
            session["blanks_data"] = blanks_data
            session["word_bank"] = word_bank
        except Exception as e:
            logging.error("Error updating session in reblank: %s", e)
            return jsonify({"error": "Failed to save exercise data"}), 500

        logging.info(
            "Successfully generated reblank exercise with %d blanks", len(blanks_data)
        )
        return jsonify(
            {
                "display_parts": display_parts,
                "blanks_data": blanks_data,
                "word_bank": word_bank,
                "exercise_title": exercise_title,
                "original_full_text": original_full_text,
            }
        )

    except Exception as e:
        logging.error("Unexpected error in reblank endpoint: %s", e)
        return jsonify({"error": "An unexpected error occurred"}), 500


@app.route("/get_new_test", methods=["POST"])
def get_new_test_route():
    """Endpoint for generating completely new text and exercise."""
    try:
        if not request.is_json:
            logging.error("Non-JSON request received at /get_new_test")
            return jsonify({"error": "Content-Type must be application/json"}), 400

        # Get the request data.
        data = request.get_json()
        logging.info("Received /get_new_test request with data: %s", data)

        if not data:
            logging.error("Empty JSON data received at /get_new_test")
            return jsonify({"error": "No data provided"}), 400

        # Validate and extract exercise_difficulty from session data.
        exercise_difficulty = _get_data_str(data, "exercise_difficulty")
        logging.info("Extracted exercise_difficulty: '%s'", exercise_difficulty)

        if not exercise_difficulty:
            logging.error("Invalid or missing exercise_difficulty in /get_new_test")
            return jsonify({"error": "Invalid or missing exercise_difficulty"}), 400

        # Validate and extract slider_value from session data.
        slider_value = _get_data_slider(data, "slider_value")
        logging.info("Extracted slider_value: %d", slider_value)

        if not slider_value:
            logging.error("Invalid or missing slider_value in /get_new_test")
            return jsonify({"error": "Invalid or missing slider_value"}), 400

        # Validate and extract include_random_words from session data.
        include_random_words = _get_data_bool(data, "include_random_words")
        logging.info("Extracted include_random_words: %s", include_random_words)

        if include_random_words is None:
            logging.error("Invalid or missing include_random_words in /get_new_test")
            return jsonify({"error": "Invalid or missing include_random_words"}), 400

        # Generate new text and blanks using percentage-based approach.
        logging.info("Calling get_exercise_with_percentage_blanks with difficulty_level=%d, include_random_words=%s, exercise_difficulty='%s'",
                    slider_value, include_random_words, exercise_difficulty)

        display_parts, blanks_data, word_bank, original_full_text, exercise_title = (
            get_exercise_with_percentage_blanks(
                slider_value,
                include_random_words,
                exercise_difficulty,
            )
        )

        logging.info("Generated exercise: title='%s', display_parts=%d, blanks=%d, word_bank=%d",
                    exercise_title, len(display_parts), len(blanks_data), len(word_bank))

        # Update session with new text and blank data.
        try:
            session["display_parts"] = display_parts
            session["blanks_data"] = blanks_data
            session["word_bank"] = word_bank
            session["exercise_title"] = exercise_title
            session["original_full_text"] = original_full_text
            logging.info("Session updated successfully")
        except Exception as e:
            logging.error("Error updating session in get_new_test: %s", e)
            return jsonify({"error": "Failed to save exercise data"}), 500

        logging.info(
            "Successfully generated new text exercise with %d blanks", len(blanks_data)
        )

        response_data = {
            "display_parts": display_parts,
            "blanks_data": blanks_data,
            "word_bank": word_bank,
            "exercise_title": exercise_title,
            "original_full_text": original_full_text,
        }
        logging.info("Returning response with keys: %s", list(response_data.keys()))

        return jsonify(response_data)

    except Exception as e:
        logging.error("Unexpected error in get_new_test endpoint: %s", e)
        return jsonify({"error": "An unexpected error occurred"}), 500
