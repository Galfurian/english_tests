# English Fill-in-the-Blanks Exercise

This is a simple web application that generates English fill-in-the-blanks exercises using the `DistilGPT2` language model. The application runs locally using Flask and provides a basic web interface.

## Features

* Generates a unique paragraph for each exercise using `DistilGPT2`.
* Randomly selects words to be removed, creating blanks.
* Provides a word bank (shuffled) for the removed words.
* Allows users to type answers into the blanks.
* Checks answers and provides a score.

## Setup and Installation

To run this application, you need Python 3.x installed on your system.

1. **Clone the repository (if you haven't already):**

    ```bash
    git clone <repository_url>
    cd english_tests
    ```

    (Note: If you're already in the directory where these files were created, you can skip this step.)

2. **Install core dependencies:**
    It's recommended to use a virtual environment to manage dependencies.

    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    pip install -r requirements.txt
    ```

3. **Install PyTorch (CPU-only version):**
    To avoid installing NVIDIA CUDA dependencies, install the CPU-only version of PyTorch:

    ```bash
    pip install torch --index-url https://download.pytorch.org/whl/cpu
    ```

    *Note: The first time you run the application, `DistilGPT2` will be downloaded by the `transformers` library. This might take some time depending on your internet connection.*

## Running the Application

1. **Activate your virtual environment (if not already active):**

    ```bash
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    ```

2. **Start the Flask development server:**

    ```bash
    python app.py
    ```

3. **Access the application:**
    Open your web browser and navigate to the address displayed in your terminal (usually `http://127.0.0.1:5000/`).

## How it Works

* The `app.py` file contains the Flask application logic.
* It uses the `transformers` library to load `DistilGPT2` and generate text.
* Words are randomly selected from the generated text to create blanks.
* The `templates/index.html` file provides the user interface.
* When you submit your answers, the application checks them against the original words and displays your score and corrections.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
