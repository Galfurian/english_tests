import logging
from network import app

# Configure logging for the main application
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)-7s] - %(name)s - %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("app.log", mode="a")],
)

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    try:
        logger.info("Starting English Tests application")
        app.run(debug=True, host="127.0.0.1", port=5000)
    except KeyboardInterrupt:
        logger.info("Application stopped by user")
    except Exception as e:
        logger.error("Failed to start application: %s", e)
        raise
