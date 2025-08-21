import random
import logging
import re
from transformers import pipeline

# Configure logging (can be moved to a central config if needed later)
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)-7s] - %(message)s"
)

# Punctuation characters to consider for blank selection.
PUNCTUATION = ".!,?;:'\"()[]{}<>"

# Set to False to use a standard text for debugging.
USE_LLM_GENERATION = True

# Fallback text for debugging purposes.
FALLBACK_TEXT = (
    "This is a standard text for debugging purposes. "
    "Basically, it provides a consistent base for testing, "
    "the blanks generation, and checking logic. "
    "You can modify this text in the code. "
)

# Prompt for the LLM to generate text.
LLM_PROMPT = (
    "You are an English teacher creating simple reading material for beginner "
    "students. Write a short, engaging paragraph about your morning routine, "
    "or a visit to a park, or cooking a simple meal. "
    "Ensure the language is simple, uses common vocabulary, and has clear, "
    "short sentences suitable for an English learner. "
    "Avoid complex grammar or obscure words."
)

# Load the DistilGPT2 model
# This will download the model the first time it's run
generator = pipeline("text-generation", model="gpt2-medium")

# --- Helper Functions for Text Generation and Blank Management ---


def generate_raw_text(initial_prompt: str, generator, text_length: int) -> str:
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


def _select_blanks(words: list[str], min_blanks: int, max_blanks: int) -> dict:
    """Selects words to be turned into blanks, returning {index: original_word}.
    Accepts min_blanks and max_blanks directly.
    """
    # Check if the words list is empty or too short.
    population_for_blanks = _get_blank_selection_population(words)
    if not population_for_blanks:
        logging.warning("No words available for blank selection.")
        return {}

    # Determine the number of blanks to select.
    num_blanks = _determine_num_blanks(
        len(population_for_blanks), min_blanks, max_blanks
    )
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
    """Extracts the initial population of words for blank selection.
    Filters words to include only those primarily composed of letters,
    allowing for internal dashes and apostrophes, and stripping external punctuation.
    """
    population = []
    for idx, word in enumerate(words):
        # First, strip leading/trailing punctuation from the word
        # Use the global PUNCTUATION constant
        cleaned_word = word.strip(PUNCTUATION)

        # Check if the cleaned word (after removing internal dashes and apostrophes)
        # consists only of alphabetic characters.
        # This allows words like "well-being" and "don't" to be considered.
        # We use isalpha() for "only letters" requirement.
        if cleaned_word.replace("-", "").replace("'", "").isalpha():
            population.append((idx, word)) # Keep the original word with punctuation for later stripping

    return population


def _determine_num_blanks(
    population_size: int, min_blanks: int, max_blanks: int
) -> int:
    """Calculates the actual number of blanks to select.
    Accepts min_blanks and max_blanks directly.
    """
    # Get the maximum possible blanks based on population size.
    max_possible_blanks = max(1, population_size // 2)

    # Ensure the range is within the bounds of the population size.
    num_blanks = random.randint(
        min(min_blanks, max_possible_blanks),
        min(max_blanks, max_possible_blanks),
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

        # Select a random word from the available population.
        chosen_item = random.choice(available_population)
        original_idx, original_word = chosen_item

        # Add to blanks_data
        blanks_data[original_idx] = original_word.strip(PUNCTUATION)
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
        blanks_data[idx] = word.strip(PUNCTUATION)
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
    word_part = word
    punctuation_part = ""

    # Iterate from the end to find trailing punctuation
    for i in range(len(word) - 1, -1, -1):
        if word[i] in PUNCTUATION:
            punctuation_part = word[i] + punctuation_part
            word_part = word[:i]
        else:
            break
    return word_part, punctuation_part


def generate_exercise_data(
    original_full_text: str, min_blanks: int, max_blanks: int
) -> tuple:
    """Generates exercise data (blanks, word bank, display parts) for a given text.
    Accepts min_blanks and max_blanks directly.
    """
    words = original_full_text.split()
    blanks_data = _select_blanks(words, min_blanks, max_blanks)

    if not blanks_data:
        # Fallback if blank selection fails for some reason
        return (
            ["This", "is", "another", "fallback", "text.", "BLANK_4"],
            {4: "fallback"},
            ["fallback"],
        )

    display_parts = _create_display_parts(words, blanks_data)
    word_bank = [blanks_data[idx] for idx in blanks_data.keys()]
    random.shuffle(word_bank)

    return display_parts, blanks_data, word_bank


def get_new_text_and_blanks(
    min_blanks: int, max_blanks: int, text_length: int
) -> tuple:
    """Generates a new text and then selects blanks for it.
    Accepts min_blanks and max_blanks directly.
    """
    if USE_LLM_GENERATION:
        generated_text = generate_raw_text(LLM_PROMPT, generator, text_length)
        if not generated_text:
            logging.error("Using fallback text due to empty generated text.")
            generated_text = FALLBACK_TEXT
    else:
        generated_text = FALLBACK_TEXT

    display_parts, blanks_data, word_bank = generate_exercise_data(
        generated_text, min_blanks, max_blanks
    )

    return display_parts, blanks_data, word_bank, generated_text
