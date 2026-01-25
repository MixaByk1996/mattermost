"""
Main entry point for the GroupBuy Bot
"""
import asyncio
import logging
import sys

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage

from config import config
from handlers import user_commands, procurement_commands
from dialogs import registration


# Configure logging
logging.basicConfig(
    level=getattr(logging, config.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


async def main():
    """Main function to start the bot"""

    # Check for token
    if not config.telegram_token:
        logger.error("TELEGRAM_TOKEN is not set!")
        sys.exit(1)

    # Initialize bot and dispatcher
    bot = Bot(
        token=config.telegram_token,
        default=DefaultBotProperties(parse_mode=ParseMode.MARKDOWN)
    )
    storage = MemoryStorage()
    dp = Dispatcher(storage=storage)

    # Register routers
    dp.include_router(user_commands.router)
    dp.include_router(procurement_commands.router)
    dp.include_router(registration.router)

    logger.info("Starting GroupBuy Bot...")

    try:
        # Delete webhook and start polling
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot stopped")
