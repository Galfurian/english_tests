import logging
import argparse
import os
from .network import app
from . import core

# Configure logging for the main application
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)-7s] - %(name)s - %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("app.log", mode="a")],
)

logger = logging.getLogger(__name__)


def parse_arguments() -> argparse.Namespace:
    """
    Parse command-line arguments for the English Tests application.

    Returns:
        argparse.Namespace: An object containing the parsed arguments.
    """
    parser = argparse.ArgumentParser(
        description="English Tests - A web application for English language exercises"
    )

    parser.add_argument(
        "--data-dir",
        type=str,
        default="data",
        help="Path to the directory containing test data JSON files (default: 'data')",
    )

    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host to bind the Flask server to (default: '127.0.0.1')",
    )

    parser.add_argument(
        "--port",
        type=int,
        default=5000,
        help="Port to bind the Flask server to (default: 5000)",
    )

    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable Flask debug mode (default: False)",
    )

    return parser.parse_args()


if __name__ == "__main__":
    try:
        args = parse_arguments()

        # Set the data directory in the core module
        core.set_data_directory(args.data_dir)

        logger.info("Starting English Tests application")
        logger.info("Data directory: %s", os.path.abspath(args.data_dir))
        logger.info("Server running on http://%s:%d", args.host, args.port)

        app.run(debug=args.debug, host=args.host, port=args.port)
    except KeyboardInterrupt:
        logger.info("Application stopped by user")
    except Exception as e:
        logger.error("Failed to start application: %s", e)
        raise
