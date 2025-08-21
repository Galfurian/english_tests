import random
import logging
import time
import json
import os

# Configure logging (can be moved to a central config if needed later)
logging.basicConfig(level=logging.INFO, format="[%(levelname)-7s] %(message)s")

# Punctuation characters to consider for blank selection.
PUNCTUATION = ".!,?;:'\"()[]{}<>"


# Load the exercises from the json.
def load_exercises_from_json(json_file_path: str = "data/exercises.json") -> list[dict]:
    """Load exercises from the JSON file."""
    try:
        # Get the absolute path relative to the script location
        current_dir = os.path.dirname(os.path.abspath(__file__))
        full_path = os.path.join(current_dir, json_file_path)

        if not os.path.exists(full_path):
            logging.error(f"Exercise file not found: {full_path}")
            return []

        with open(full_path, "r", encoding="utf-8") as file:
            data = json.load(file)
            exercises = data.get("exercises", [])
            logging.info(
                f"Successfully loaded {len(exercises)} exercises from {json_file_path}"
            )
            return exercises

    except json.JSONDecodeError as e:
        logging.error(f"Error parsing JSON file {json_file_path}: {e}")
        return []
    except FileNotFoundError:
        logging.error(f"Exercise file not found: {json_file_path}")
        return []
    except Exception as e:
        logging.error(f"Unexpected error loading exercises: {e}")
        return []


# Global variable to store loaded exercises
EXERCISES = load_exercises_from_json()


def _select_blanks(
    words: list[str], min_blanks: int, max_blanks: int
) -> dict[int, str]:
    """Selects words to be turned into blanks, returning {index: original_word}.
    Accepts min_blanks and max_blanks directly.
    """
    # Input validation
    if not isinstance(words, list):
        logging.error("Invalid words parameter: expected list, got %s", type(words))
        return {}

    if not words:
        logging.warning("Empty words list provided to _select_blanks")
        return {}

    if not isinstance(min_blanks, int) or not isinstance(max_blanks, int):
        logging.error(
            "Invalid blank parameters: min_blanks=%s, max_blanks=%s",
            min_blanks,
            max_blanks,
        )
        return {}

    if min_blanks < 0 or max_blanks < 0:
        logging.error(
            "Negative blank counts not allowed: min_blanks=%d, max_blanks=%d",
            min_blanks,
            max_blanks,
        )
        return {}

    if min_blanks > max_blanks:
        logging.warning(
            "min_blanks (%d) > max_blanks (%d), swapping values", min_blanks, max_blanks
        )
        min_blanks, max_blanks = max_blanks, min_blanks

    try:
        # Check if the words list is empty or too short.
        population_for_blanks = _get_blank_selection_population(words)
        if not population_for_blanks:
            logging.warning(
                "No words available for blank selection from %d total words.",
                len(words),
            )
            return {}

        # Determine the number of blanks to select.
        num_blanks = _determine_num_blanks(
            len(population_for_blanks), min_blanks, max_blanks
        )
        if num_blanks == 0:
            logging.warning(
                "No blanks to select based on the population size of %d.",
                len(population_for_blanks),
            )
            return {}

        blanks_data = _select_non_adjacent_blanks(population_for_blanks, num_blanks)

        # If non-adjacent selection failed to get enough blanks
        if len(blanks_data) < num_blanks:
            logging.warning(
                "Could not select enough non-adjacent blanks (%d/%d), falling back to random selection.",
                len(blanks_data),
                num_blanks,
            )
            blanks_data = _select_random_blanks(population_for_blanks, num_blanks)

        logging.info(
            "Successfully selected %d blanks from %d available words",
            len(blanks_data),
            len(population_for_blanks),
        )
        return blanks_data

    except Exception as e:
        logging.error("Unexpected error in _select_blanks: %s", e)
        return {}


def _get_blank_selection_population(words: list[str]) -> list[tuple[int, str]]:
    """Extracts the initial population of words for blank selection.
    Filters words to include only those primarily composed of letters,
    allowing for internal dashes and apostrophes, and stripping external punctuation.
    """
    if not isinstance(words, list):
        logging.error("Invalid words parameter: expected list, got %s", type(words))
        return []

    if not words:
        logging.warning("Empty words list provided to _get_blank_selection_population")
        return []

    try:
        population = []
        for idx, word in enumerate(words):
            if not isinstance(word, str):
                logging.warning(
                    "Non-string word at index %d: %s, skipping", idx, repr(word)
                )
                continue

            if not word.strip():  # Skip empty or whitespace-only words
                logging.debug("Empty word at index %d, skipping", idx)
                continue

            # First, strip leading/trailing punctuation from the word
            # Use the global PUNCTUATION constant
            cleaned_word = word.strip(PUNCTUATION)

            # Check if the cleaned word (after removing internal dashes and apostrophes)
            # consists only of alphabetic characters.
            # This allows words like "well-being" and "don't" to be considered.
            # We use isalpha() for "only letters" requirement.
            if cleaned_word.replace("-", "").replace("'", "").isalpha():
                population.append(
                    (idx, word)
                )  # Keep the original word with punctuation for later stripping

        logging.debug(
            "Selected %d words from %d total for blank population",
            len(population),
            len(words),
        )
        return population

    except Exception as e:
        logging.error("Unexpected error in _get_blank_selection_population: %s", e)
        return []


def _determine_num_blanks(
    population_size: int, min_blanks: int, max_blanks: int
) -> int:
    """Calculates the actual number of blanks to select.
    Accepts min_blanks and max_blanks directly.
    """
    # Input validation
    if not isinstance(population_size, int) or population_size < 0:
        logging.error("Invalid population_size: %s", population_size)
        return 0

    if not isinstance(min_blanks, int) or not isinstance(max_blanks, int):
        logging.error(
            "Invalid blank parameters: min_blanks=%s, max_blanks=%s",
            min_blanks,
            max_blanks,
        )
        return 0

    if min_blanks < 0 or max_blanks < 0:
        logging.error(
            "Negative blank counts not allowed: min_blanks=%d, max_blanks=%d",
            min_blanks,
            max_blanks,
        )
        return 0

    if population_size == 0:
        logging.warning("Population size is 0, cannot select any blanks")
        return 0

    try:
        # Get the maximum possible blanks based on population size.
        max_possible_blanks = max(1, population_size // 2)

        # Ensure the range is within the bounds of the population size.
        effective_min = min(min_blanks, max_possible_blanks)
        effective_max = min(max_blanks, max_possible_blanks)

        if effective_min > effective_max:
            logging.warning(
                "Effective min (%d) > effective max (%d), using min value",
                effective_min,
                effective_max,
            )
            return effective_min

        num_blanks = random.randint(effective_min, effective_max)

        # Ensure at least one blank is selected if possible.
        if num_blanks == 0 and max_possible_blanks > 0:
            num_blanks = 1

        logging.debug(
            "Determined %d blanks from population of %d (range: %d-%d)",
            num_blanks,
            population_size,
            min_blanks,
            max_blanks,
        )
        return num_blanks

    except Exception as e:
        logging.error("Unexpected error in _determine_num_blanks: %s", e)
        return 1 if population_size > 0 else 0


def _select_non_adjacent_blanks(
    population: list[tuple[int, str]], num_blanks: int
) -> dict[int, str]:
    """Selects non-adjacent blanks from the population."""
    # Input validation
    if not isinstance(population, list):
        logging.error(
            "Invalid population parameter: expected list, got %s", type(population)
        )
        return {}

    if not isinstance(num_blanks, int) or num_blanks < 0:
        logging.error("Invalid num_blanks parameter: %s", num_blanks)
        return {}

    if not population:
        logging.warning("Empty population provided to _select_non_adjacent_blanks")
        return {}

    if num_blanks == 0:
        logging.debug("num_blanks is 0, returning empty dict")
        return {}

    try:
        blanks_data: dict[int, str] = {}
        selected_indices = set()
        available_population = list(population)

        for attempt in range(num_blanks):
            if not available_population:
                logging.warning(
                    "Not enough words in population to select all non-adjacent blanks. "
                    "Selected %d out of %d requested blanks.",
                    len(blanks_data),
                    num_blanks,
                )
                break

            # Select a random word from the available population.
            try:
                chosen_item = random.choice(available_population)
                original_idx, original_word = chosen_item

                if not isinstance(original_idx, int) or not isinstance(
                    original_word, str
                ):
                    logging.error(
                        "Invalid population item at attempt %d: %s",
                        attempt,
                        chosen_item,
                    )
                    continue

            except (IndexError, ValueError, TypeError) as e:
                logging.error(
                    "Error selecting from population at attempt %d: %s", attempt, e
                )
                break

            # Add to blanks_data
            try:
                blanks_data[original_idx] = original_word.strip(PUNCTUATION)
                selected_indices.add(original_idx)
            except (AttributeError, TypeError) as e:
                logging.error(
                    "Error processing selected word at attempt %d: %s", attempt, e
                )
                continue

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

        logging.debug("Selected %d non-adjacent blanks successfully", len(blanks_data))
        return blanks_data

    except Exception as e:
        logging.error("Unexpected error in _select_non_adjacent_blanks: %s", e)
        return {}


def _select_random_blanks(population: list[tuple[int, str]], num_blanks: int) -> dict:
    """Selects random blanks from the population (fallback)."""
    # Input validation
    if not isinstance(population, list):
        logging.error(
            "Invalid population parameter: expected list, got %s", type(population)
        )
        return {}

    if not isinstance(num_blanks, int) or num_blanks < 0:
        logging.error("Invalid num_blanks parameter: %s", num_blanks)
        return {}

    if not population:
        logging.warning("Empty population provided to _select_random_blanks")
        return {}

    if num_blanks == 0:
        logging.debug("num_blanks is 0, returning empty dict")
        return {}

    if num_blanks > len(population):
        logging.warning(
            "num_blanks (%d) > population size (%d), using population size",
            num_blanks,
            len(population),
        )
        num_blanks = len(population)

    try:
        # Get a random sample of words from the population.
        words_to_remove_from_population = random.sample(population, num_blanks)

        # Sort by index to maintain order in the final output.
        words_to_remove_from_population.sort(key=lambda x: x[0])

        # Create a dictionary with the index as key and the word as value.
        blanks_data = {}
        for idx, word in words_to_remove_from_population:
            if not isinstance(idx, int) or not isinstance(word, str):
                logging.error("Invalid population item: (%s, %s)", idx, word)
                continue
            try:
                blanks_data[idx] = word.strip(PUNCTUATION)
            except (AttributeError, TypeError) as e:
                logging.error(
                    "Error processing word '%s' at index %d: %s", word, idx, e
                )
                continue

        logging.debug("Selected %d random blanks successfully", len(blanks_data))
        return blanks_data

    except ValueError as e:
        logging.error("Error sampling from population: %s", e)
        return {}
    except Exception as e:
        logging.error("Unexpected error in _select_random_blanks: %s", e)
        return {}


def _create_display_parts(words: list[str], blanks_data: dict) -> list[str]:
    """Creates the list of display parts (words or BLANK_X placeholders)."""
    # Input validation
    if not isinstance(words, list):
        logging.error("Invalid words parameter: expected list, got %s", type(words))
        return []

    if not isinstance(blanks_data, dict):
        logging.error(
            "Invalid blanks_data parameter: expected dict, got %s", type(blanks_data)
        )
        return []

    if not words:
        logging.warning("Empty words list provided to _create_display_parts")
        return []

    try:
        display_parts = []
        for i, word in enumerate(words):
            if not isinstance(word, str):
                logging.warning(
                    "Non-string word at index %d: %s, converting to string",
                    i,
                    repr(word),
                )
                word = str(word)

            if i in blanks_data:
                try:
                    word_part, punctuation_part = _split_word_and_punctuation(word)
                    display_parts.append(f"BLANK_{i}")
                    if punctuation_part:
                        display_parts.append(punctuation_part)
                except Exception as e:
                    logging.error(
                        "Error splitting word '%s' at index %d: %s", word, i, e
                    )
                    display_parts.append(f"BLANK_{i}")  # Fallback without punctuation
            else:
                display_parts.append(word)

        logging.debug(
            "Created %d display parts from %d words with %d blanks",
            len(display_parts),
            len(words),
            len(blanks_data),
        )
        return display_parts

    except Exception as e:
        logging.error("Unexpected error in _create_display_parts: %s", e)
        return [str(word) for word in words]  # Fallback: return words as strings


def _split_word_and_punctuation(word: str) -> tuple[str, str]:
    """Splits a word into its word part and trailing punctuation part."""
    # Input validation
    if not isinstance(word, str):
        logging.error("Invalid word parameter: expected string, got %s", type(word))
        return str(word), ""

    if not word:
        logging.warning("Empty word provided to _split_word_and_punctuation")
        return "", ""

    try:
        word_part = word
        punctuation_part = ""

        # Iterate from the end to find trailing punctuation
        for i in range(len(word) - 1, -1, -1):
            if word[i] in PUNCTUATION:
                punctuation_part = word[i] + punctuation_part
                word_part = word[:i]
            else:
                break

        logging.debug(
            "Split '%s' into word='%s' and punctuation='%s'",
            word,
            word_part,
            punctuation_part,
        )
        return word_part, punctuation_part

    except Exception as e:
        logging.error(
            "Unexpected error in _split_word_and_punctuation for word '%s': %s", word, e
        )
        return word, ""  # Fallback: return original word with no punctuation


def generate_exercise_data(
    original_full_text: str, min_blanks: int, max_blanks: int
) -> tuple:
    """Generates exercise data (blanks, word bank, display parts) for a given text.
    Accepts min_blanks and max_blanks directly.
    """
    # Input validation
    if not isinstance(original_full_text, str):
        logging.error(
            "Invalid original_full_text parameter: expected string, got %s",
            type(original_full_text),
        )
        return _get_fallback_exercise_data()

    if not original_full_text.strip():
        logging.error(
            "Empty or whitespace-only text provided to generate_exercise_data"
        )
        return _get_fallback_exercise_data()

    if not isinstance(min_blanks, int) or not isinstance(max_blanks, int):
        logging.error(
            "Invalid blank parameters: min_blanks=%s, max_blanks=%s",
            min_blanks,
            max_blanks,
        )
        return _get_fallback_exercise_data()

    if min_blanks < 0 or max_blanks < 0:
        logging.error(
            "Negative blank counts not allowed: min_blanks=%d, max_blanks=%d",
            min_blanks,
            max_blanks,
        )
        return _get_fallback_exercise_data()

    try:
        logging.info(
            "Generating exercise data for text length: %d", len(original_full_text)
        )

        words = original_full_text.split()
        if not words:
            logging.error("No words found in text after splitting")
            return _get_fallback_exercise_data()

        logging.info("Processing %d words for blank selection", len(words))

        blanks_data = _select_blanks(words, min_blanks, max_blanks)

        if not blanks_data:
            logging.warning("No blanks selected, using fallback exercise data")
            return _get_fallback_exercise_data()

        display_parts = _create_display_parts(words, blanks_data)

        if not display_parts:
            logging.error("Failed to create display parts")
            return _get_fallback_exercise_data()

        word_bank = [blanks_data[idx] for idx in blanks_data.keys()]

        if not word_bank:
            logging.error("Failed to create word bank")
            return _get_fallback_exercise_data()

        try:
            random.shuffle(word_bank)
        except Exception as e:
            logging.warning("Failed to shuffle word bank: %s", e)

        logging.info(
            "Successfully generated exercise with %d blanks and %d display parts",
            len(blanks_data),
            len(display_parts),
        )
        return display_parts, blanks_data, word_bank

    except Exception as e:
        logging.error("Unexpected error in generate_exercise_data: %s", e)
        return _get_fallback_exercise_data()


def _get_fallback_exercise_data() -> tuple:
    """Returns fallback exercise data when main generation fails."""
    logging.info("Using fallback exercise data")
    return (
        ["This", "is", "a", "fallback", "text.", "BLANK_4"],
        {4: "fallback"},
        ["fallback"],
    )


def get_new_text_and_blanks(
    min_blanks: int, max_blanks: int, text_length: int | None = None
) -> tuple:
    """Selects a random exercise from the loaded exercises and generates blanks for it.

    Args:
        min_blanks: Minimum number of blanks to create
        max_blanks: Maximum number of blanks to create
        text_length: Ignored (kept for backward compatibility)

    Returns:
        Tuple of (display_parts, blanks_data, word_bank, selected_text)
    """
    # Input validation
    if not isinstance(min_blanks, int) or not isinstance(max_blanks, int):
        logging.error(
            "Invalid parameters: min_blanks=%s, max_blanks=%s",
            min_blanks,
            max_blanks,
        )
        return _get_fallback_exercise_data() + ("Fallback exercise text.",)

    if min_blanks < 0 or max_blanks < 0:
        logging.error(
            "Invalid parameter values: min_blanks=%d, max_blanks=%d",
            min_blanks,
            max_blanks,
        )
        return _get_fallback_exercise_data() + ("Fallback exercise text.",)

    try:
        logging.info(
            "Selecting exercise and generating blanks: min_blanks=%d, max_blanks=%d",
            min_blanks,
            max_blanks,
        )

        # Check if exercises are available
        if not EXERCISES:
            logging.warning("No exercises loaded, using fallback")
            return _get_fallback_exercise_data() + ("Fallback exercise text.",)

        # Select a random exercise
        try:
            selected_exercise = random.choice(EXERCISES)
            selected_text = selected_exercise.get("text", "")
            exercise_title = selected_exercise.get("title", "Unknown")

            if not selected_text or not selected_text.strip():
                logging.warning(
                    f"Empty text in exercise '{exercise_title}', using fallback"
                )
                return _get_fallback_exercise_data() + ("Fallback exercise text.",)

            logging.info(
                f"Selected exercise: '{exercise_title}' (length: {len(selected_text)})"
            )

        except (IndexError, TypeError, KeyError) as e:
            logging.error(f"Error selecting exercise: {e}, using fallback")
            return _get_fallback_exercise_data() + ("Fallback exercise text.",)

        # Generate exercise data from the selected text
        try:
            display_parts, blanks_data, word_bank = generate_exercise_data(
                selected_text, min_blanks, max_blanks
            )

            # Validate the results
            if not display_parts or not blanks_data or not word_bank:
                logging.error(
                    "Exercise generation returned invalid data, using fallback"
                )
                return _get_fallback_exercise_data() + ("Fallback exercise text.",)

            logging.info(
                "Successfully generated exercise with %d display parts, %d blanks, %d word bank items",
                len(display_parts),
                len(blanks_data),
                len(word_bank),
            )
            return display_parts, blanks_data, word_bank, selected_text

        except Exception as e:
            logging.error(
                "Error during exercise data generation: %s, using fallback", e
            )
            return _get_fallback_exercise_data() + ("Fallback exercise text.",)

    except Exception as e:
        logging.error(
            "Unexpected error in get_new_text_and_blanks: %s, using fallback", e
        )
        return _get_fallback_exercise_data() + ("Fallback exercise text.",)
