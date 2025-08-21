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
def _load_exercises_from_json(
    json_file_path: str = "data/exercises.json",
) -> list[dict]:
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
EXERCISES = _load_exercises_from_json()


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


def _add_random_words_to_bank(
    word_bank: list[str], words: list[str], blanks_data: dict[int, str]
) -> list[str]:
    """Adds random words from the text to the word bank to increase difficulty.

    Args:
        word_bank: Current word bank containing correct answers
        words: All words from the original text
        blanks_data: Dictionary of blank indices and their correct words

    Returns:
        Enhanced word bank with additional random words
    """
    # Input validation
    if not isinstance(word_bank, list):
        logging.error(
            "Invalid word_bank parameter: expected list, got %s", type(word_bank)
        )
        return word_bank

    if not isinstance(words, list):
        logging.error("Invalid words parameter: expected list, got %s", type(words))
        return word_bank

    if not isinstance(blanks_data, dict):
        logging.error(
            "Invalid blanks_data parameter: expected dict, got %s", type(blanks_data)
        )
        return word_bank

    try:
        # Create a set of words that are already in blanks (to avoid duplicates)
        blank_words = set(
            word.lower().strip(PUNCTUATION) for word in blanks_data.values()
        )

        # Get potential random words from the text
        potential_words = []
        for idx, word in enumerate(words):
            if not isinstance(word, str):
                continue

            # Clean the word
            cleaned_word = word.strip(PUNCTUATION)

            # Only consider words that are primarily letters and not already in blanks
            if (
                cleaned_word.replace("-", "").replace("'", "").isalpha()
                and cleaned_word.lower() not in blank_words
                and len(cleaned_word) > 2
            ):  # Avoid very short words like "a", "an"
                potential_words.append(cleaned_word)

        # Remove duplicates while preserving order
        seen = set()
        unique_potential_words = []
        for word in potential_words:
            word_lower = word.lower()
            if word_lower not in seen:
                seen.add(word_lower)
                unique_potential_words.append(word)

        if not unique_potential_words:
            logging.info("No suitable random words found in text")
            return word_bank

        # Calculate how many random words to add (50-75% of the number of correct answers)
        num_correct_words = len(word_bank)
        min_random = max(1, int(num_correct_words * 0.5))
        max_random = max(min_random, int(num_correct_words * 0.75))
        num_random_words = min(
            random.randint(min_random, max_random), len(unique_potential_words)
        )

        # Select random words
        random_words = random.sample(unique_potential_words, num_random_words)

        # Add to word bank
        enhanced_word_bank = word_bank + random_words

        logging.info(
            "Added %d random words to word bank (original: %d, enhanced: %d)",
            len(random_words),
            len(word_bank),
            len(enhanced_word_bank),
        )

        return enhanced_word_bank

    except Exception as e:
        logging.error("Error adding random words to bank: %s", e)
        return word_bank


def _generate_exercise_data(
    original_full_text: str,
    min_blanks: int,
    max_blanks: int,
    include_random_words: bool = False,
) -> tuple:
    """Generates exercise data (blanks, word bank, display parts) for a given text.
    Accepts min_blanks and max_blanks directly.

    Args:
        original_full_text: The text to create blanks in
        min_blanks: Minimum number of blanks to create
        max_blanks: Maximum number of blanks to create
        include_random_words: If True, adds random words from the text to the word bank
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
            "Empty or whitespace-only text provided to _generate_exercise_data"
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

        # Add random words from the text if requested
        if include_random_words:
            word_bank = _add_random_words_to_bank(word_bank, words, blanks_data)

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
        logging.error("Unexpected error in _generate_exercise_data: %s", e)
        return _get_fallback_exercise_data()


def _get_fallback_exercise_data() -> tuple:
    """Returns fallback exercise data when main generation fails."""
    logging.info("Using fallback exercise data")
    return (
        ["This", "is", "a", "fallback", "text.", "BLANK_4"],
        {4: "fallback"},
        ["fallback"],
    )


def get_random_exercise() -> dict:
    """Selects a random exercise from the loaded exercises.

    Returns:
        Dictionary containing the exercise data with 'text' and 'title' keys.
        Returns a fallback exercise if no exercises are available or on error.
    """
    try:
        logging.info("Selecting random exercise from loaded exercises")

        # Check if exercises are available
        if not EXERCISES:
            logging.warning("No exercises loaded, using fallback")
            return {
                "text": "This is a fallback exercise text.",
                "title": "Fallback Exercise",
            }

        # Select a random exercise
        try:
            selected_exercise = random.choice(EXERCISES)
            selected_text = selected_exercise.get("text", "")
            exercise_title = selected_exercise.get("title", "Unknown")

            if not selected_text or not selected_text.strip():
                logging.warning(
                    f"Empty text in exercise '{exercise_title}', using fallback"
                )
                return {
                    "text": "This is a fallback exercise text.",
                    "title": "Fallback Exercise",
                }

            logging.info(
                f"Selected exercise: '{exercise_title}' (length: {len(selected_text)})"
            )
            return selected_exercise

        except (IndexError, TypeError, KeyError) as e:
            logging.error(f"Error selecting exercise: {e}, using fallback")
            return {
                "text": "This is a fallback exercise text.",
                "title": "Fallback Exercise",
            }

    except Exception as e:
        logging.error("Unexpected error in get_random_exercise: %s, using fallback", e)
        return {
            "text": "This is a fallback exercise text.",
            "title": "Fallback Exercise",
        }


def create_exercise_with_blanks_percentage(
    exercise_text: str, difficulty_level: int, include_random_words: bool = False
) -> tuple:
    """Creates an exercise with blanks from the given text using percentage-based difficulty.

    Args:
        exercise_text: The text to create blanks in
        difficulty_level: Integer from 1 to 10 determining the percentage of blanks
                         (1 = ~5% blanks, 10 = ~25% blanks)
        include_random_words: If True, adds random words from the text to the word bank

    Returns:
        Tuple of (display_parts, blanks_data, word_bank)
    """
    # Input validation
    if not isinstance(exercise_text, str):
        logging.error(
            "Invalid exercise_text parameter: expected string, got %s",
            type(exercise_text),
        )
        return _get_fallback_exercise_data()

    if not exercise_text.strip():
        logging.error("Empty or whitespace-only text provided")
        return _get_fallback_exercise_data()

    if not isinstance(difficulty_level, int):
        logging.error(
            "Invalid difficulty_level parameter: expected int, got %s",
            type(difficulty_level),
        )
        return _get_fallback_exercise_data()

    if difficulty_level < 1 or difficulty_level > 10:
        logging.error(
            "Invalid difficulty_level value: %d (must be 1-10)",
            difficulty_level,
        )
        return _get_fallback_exercise_data()

    try:
        logging.info(
            "Creating exercise with blanks: difficulty_level=%d, text_length=%d, include_random_words=%s",
            difficulty_level,
            len(exercise_text),
            include_random_words,
        )

        # Calculate percentage of blanks based on difficulty level
        # Level 1 = 5%, Level 10 = 25%
        min_percentage = 5 + (difficulty_level - 1) * 2.0  # 5% to 23%
        max_percentage = min_percentage + 4.0  # Add 4% range

        # Ensure we don't exceed 25% for the maximum
        max_percentage = min(max_percentage, 25.0)

        # Count words in the text to calculate actual min/max blanks
        words = exercise_text.split()
        if not words:
            logging.error("No words found in text after splitting")
            return _get_fallback_exercise_data()

        total_words = len(words)

        # Calculate min and max blanks based on percentages
        min_blanks = max(1, int(total_words * min_percentage / 100.0))
        max_blanks = max(min_blanks + 1, int(total_words * max_percentage / 100.0))

        logging.info(
            "Calculated blanks from %d words: min=%d (%.1f%%), max=%d (%.1f%%)",
            total_words,
            min_blanks,
            min_percentage,
            max_blanks,
            max_percentage,
        )

        # Generate exercise data using the calculated min/max blanks
        display_parts, blanks_data, word_bank = _generate_exercise_data(
            exercise_text, min_blanks, max_blanks, include_random_words
        )

        # Validate the results
        if not display_parts or not blanks_data or not word_bank:
            logging.error("Exercise generation returned invalid data, using fallback")
            return _get_fallback_exercise_data()

        logging.info(
            "Successfully created exercise with %d display parts, %d blanks, %d word bank items",
            len(display_parts),
            len(blanks_data),
            len(word_bank),
        )
        return display_parts, blanks_data, word_bank

    except Exception as e:
        logging.error("Error during exercise creation: %s, using fallback", e)
        return _get_fallback_exercise_data()


def get_exercise_with_percentage_blanks(
    difficulty_level: int, include_random_words: bool = False
) -> tuple:
    """Selects a random exercise and generates blanks using percentage-based difficulty.

    Args:
        difficulty_level: Integer from 1 to 10 determining the percentage of blanks
                         (1 = ~5% blanks, 10 = ~25% blanks)
        include_random_words: If True, adds random words from the text to the word bank

    Returns:
        Tuple of (display_parts, blanks_data, word_bank, selected_text, exercise_title)
    """
    try:
        # Get a random exercise
        exercise = get_random_exercise()
        exercise_text = exercise.get("text", "")
        exercise_title = exercise.get("title", "Unknown Exercise")

        if not exercise_text:
            logging.error("No text found in selected exercise")
            return _get_fallback_exercise_data() + ("Fallback exercise text.", "Fallback Exercise")

        # Create the exercise with percentage-based blanks
        display_parts, blanks_data, word_bank = create_exercise_with_blanks_percentage(
            exercise_text, difficulty_level, include_random_words
        )

        return display_parts, blanks_data, word_bank, exercise_text, exercise_title

    except Exception as e:
        logging.error(
            "Unexpected error in get_exercise_with_percentage_blanks: %s, using fallback",
            e,
        )
        return _get_fallback_exercise_data() + ("Fallback exercise text.", "Fallback Exercise")
