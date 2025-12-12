# English Tests

This is a web application for English language tests with multiple difficulty levels. The application provides fill-in-the-blanks exercises using pre-loaded data for beginner, intermediate, and advanced levels. It runs locally using Flask and provides a web interface.

## Features

* Provides exercises at three difficulty levels: beginner, intermediate, and advanced.
* Randomly selects words to be removed, creating blanks based on a configurable percentage.
* Provides a word bank (shuffled) for the removed words.
* Allows users to type answers into the blanks.
* Checks answers and provides a score with corrections.

## Setup and Installation

To run this application, you need Python 3.8 or higher installed on your system.

1. **Clone the repository (if you haven't already):**

    ```bash
    git clone https://github.com/Galfurian/english_tests.git
    cd english_tests
    ```

    (Note: If you're already in the directory where these files were created, you can skip this step.)

2. **Install dependencies:**
    It's recommended to use a virtual environment to manage dependencies.

    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    pip install -e .
    ```

## Running the Application

1. **Activate your virtual environment (if not already active):**

    ```bash
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    ```

2. **Start the Flask development server:**

    ```bash
    python -m english_tests.app
    ```

3. **Access the application:**
    Open your web browser and navigate to the address displayed in your terminal (usually `http://127.0.0.1:5000/`).

## How it Works

* The `app.py` file contains the Flask application logic.
* Exercises are loaded from JSON files in the `data/` directory (`beginner.json`, `intermediate.json`, `advanced.json`).
* Words are randomly selected from the exercise text to create blanks based on the configured percentage.
* The `templates/index.html` file provides the user interface.
* When you submit your answers, the application checks them against the original words and displays your score and corrections.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
