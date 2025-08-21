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


def _compute_min_max_blanks(
    slider_value: float,
    text_length: int,
    min_percentage: int,
    max_percentage: int,
):
    """Computes min and max blanks based on slider value and text length."""
    # Input validation
    try:
        slider_value = float(slider_value)
        text_length = int(text_length)
        min_percentage = int(min_percentage)
        max_percentage = int(max_percentage)
    except (ValueError, TypeError) as e:
        logging.error("Invalid parameter types in _compute_min_max_blanks: %s", e)
        return 1, 2  # Safe defaults

    if text_length <= 0:
        logging.error("Invalid text_length: %d", text_length)
        return 1, 2

    if (
        min_percentage < 0
        or max_percentage < 0
        or min_percentage > 100
        or max_percentage > 100
    ):
        logging.error(
            "Invalid percentage range: min=%d, max=%d", min_percentage, max_percentage
        )
        return 1, 2

    if min_percentage > max_percentage:
        logging.warning(
            "min_percentage (%d) > max_percentage (%d), swapping",
            min_percentage,
            max_percentage,
        )
        min_percentage, max_percentage = max_percentage, min_percentage

    try:
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

        logging.debug(
            "Computed blanks: min=%d, max=%d (slider=%.1f, text_len=%d, est_words=%.1f)",
            min_blanks,
            max_blanks,
            slider_value + 1,
            text_length,
            estimated_words,
        )
        return min_blanks, max_blanks

    except Exception as e:
        logging.error("Unexpected error in _compute_min_max_blanks: %s", e)
        return 1, 2  # Safe defaults


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

            except Exception as e:
                logging.error("Error retrieving session data: %s", e)
                display_parts = []
                blanks_data = {}
                word_bank = []
                original_full_text = ""
        else:
            logging.info("No exercise in session. Rendering empty page.")
            # Render with empty data if no exercise is in session
            display_parts = []
            blanks_data = {}
            word_bank = []
            original_full_text = ""

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


def _extract_user_answers(form) -> dict[int, str]:
    """Extracts user answers from form data."""
    if not form:
        logging.warning("Empty form provided to _extract_user_answers")
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
        logging.error("Unexpected error in _extract_user_answers: %s", e)
        return {}


def _get_exercise_data_from_session(session) -> tuple[list[str], dict[int, str], str]:
    """Retrieves exercise data from session with validation."""
    if not session:
        logging.error("No session provided to _get_exercise_data_from_session")
        return [], {}, ""

    try:
        display_parts = session.get("display_parts", [])
        blanks_data = session.get("blanks_data", {})
        original_full_text = session.get("original_full_text", "")

        # Validate types
        if not isinstance(display_parts, list):
            logging.warning(
                "Invalid display_parts type in session: %s", type(display_parts)
            )
            display_parts = []

        if not isinstance(blanks_data, dict):
            logging.warning(
                "Invalid blanks_data type in session: %s", type(blanks_data)
            )
            blanks_data = {}
        else:
            # Validate blanks_data content
            validated_blanks_data = {}
            for key, value in blanks_data.items():
                try:
                    key_int = int(key) if not isinstance(key, int) else key
                    value_str = str(value) if not isinstance(value, str) else value
                    validated_blanks_data[key_int] = value_str
                except (ValueError, TypeError) as e:
                    logging.warning(
                        "Invalid blanks_data item (%s: %s): %s", key, value, e
                    )
                    continue
            blanks_data = validated_blanks_data

        if not isinstance(original_full_text, str):
            logging.warning(
                "Invalid original_full_text type in session: %s",
                type(original_full_text),
            )
            original_full_text = ""

        logging.debug(
            "Retrieved session data: %d display parts, %d blanks, text length %d",
            len(display_parts),
            len(blanks_data),
            len(original_full_text),
        )
        return display_parts, blanks_data, original_full_text

    except Exception as e:
        logging.error("Unexpected error in _get_exercise_data_from_session: %s", e)
        return [], {}, ""


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


def _process_post_request():
    """Processes POST requests for answer submission."""
    try:
        if not request.form:
            logging.warning("Empty form submitted")
            return (
                render_template("error.html", error="No answers were submitted."),
                400,
            )

        user_answers = _extract_user_answers(request.form)
        display_parts, blanks_data, original_full_text = (
            _get_exercise_data_from_session(session)
        )

        if not blanks_data:
            logging.error("No exercise data found in session for answer evaluation")
            return (
                render_template(
                    "error.html",
                    error="No exercise found. Please generate a new exercise.",
                ),
                400,
            )

        results, score, total_blanks = _evaluate_answers(
            user_answers, blanks_data, display_parts
        )

        return render_template(
            "index.html",
            display_parts=display_parts,
            word_bank=[],
            results=results,
            score=score,
            total_blanks=total_blanks,
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

        # Get the original text.
        original_text = data.get("original_text")
        if (
            not original_text
            or not isinstance(original_text, str)
            or not original_text.strip()
        ):
            logging.error("Invalid or missing original_text in request")
            return jsonify({"error": "Invalid or missing original_text"}), 400

        # Get the slider value.
        slider_value = data.get("slider_value", 5)
        try:
            slider_value = int(slider_value)
            if slider_value < 1 or slider_value > 10:
                logging.warning("Slider value %d out of range, clamping", slider_value)
                slider_value = max(1, min(10, slider_value))
        except (ValueError, TypeError):
            logging.warning("Invalid slider_value, using default: %s", slider_value)
            slider_value = 5

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

        if not display_parts or not blanks_data or not word_bank:
            logging.error("Failed to generate exercise data for reblank")
            return jsonify({"error": "Failed to generate exercise data"}), 500

        # Update session with new blank data
        try:
            session["display_parts"] = display_parts
            session["blanks_data"] = blanks_data
            session["word_bank"] = word_bank
            session["original_full_text"] = original_text
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
            }
        )

    except Exception as e:
        logging.error("Unexpected error in reblank endpoint: %s", e)
        return jsonify({"error": "An unexpected error occurred"}), 500


@app.route("/generate_new_text", methods=["POST"])
def generate_new_text_route():
    """Endpoint for generating completely new text and exercise."""
    try:
        if not request.is_json:
            logging.error("Non-JSON request received at /generate_new_text")
            return jsonify({"error": "Content-Type must be application/json"}), 400

        # Get the request data.
        data = request.get_json()
        if not data:
            logging.error("Empty JSON data received at /generate_new_text")
            return jsonify({"error": "No data provided"}), 400

        # Get text_length from request
        text_length = data.get("text_length", 80)
        try:
            text_length = int(text_length)
            if text_length <= 0:
                logging.warning("Invalid text_length %d, using default", text_length)
                text_length = 80
            elif text_length > 500:
                logging.warning("Text length %d too large, capping at 500", text_length)
                text_length = 500
        except (ValueError, TypeError):
            logging.warning("Invalid text_length type, using default: %s", text_length)
            text_length = 80

        # Get the slider value.
        slider_value = data.get("slider_value", 5)
        try:
            slider_value = int(slider_value)
            if slider_value < 1 or slider_value > 10:
                logging.warning("Slider value %d out of range, clamping", slider_value)
                slider_value = max(1, min(10, slider_value))
        except (ValueError, TypeError):
            logging.warning("Invalid slider_value, using default: %s", slider_value)
            slider_value = 5

        # Compute the minimum and maximum number of blanks.
        min_blanks, max_blanks = _compute_min_max_blanks(
            slider_value,
            text_length,
            5,
            25,
        )

        # Generate new text and blanks.
        display_parts, blanks_data, word_bank, original_full_text = (
            get_new_text_and_blanks(
                min_blanks=min_blanks,
                max_blanks=max_blanks,
                text_length=text_length,
            )
        )

        if (
            not display_parts
            or not blanks_data
            or not word_bank
            or not original_full_text
        ):
            logging.error("Failed to generate new text and exercise data")
            return jsonify({"error": "Failed to generate exercise"}), 500

        # Update session with new text and blank data.
        try:
            session["display_parts"] = display_parts
            session["blanks_data"] = blanks_data
            session["word_bank"] = word_bank
            session["original_full_text"] = original_full_text
        except Exception as e:
            logging.error("Error updating session in generate_new_text: %s", e)
            return jsonify({"error": "Failed to save exercise data"}), 500

        logging.info(
            "Successfully generated new text exercise with %d blanks", len(blanks_data)
        )
        return jsonify(
            {
                "display_parts": display_parts,
                "blanks_data": blanks_data,
                "word_bank": word_bank,
                "original_full_text": original_full_text,
            }
        )

    except Exception as e:
        logging.error("Unexpected error in generate_new_text endpoint: %s", e)
        return jsonify({"error": "An unexpected error occurred"}), 500
