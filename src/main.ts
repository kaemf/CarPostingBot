// CarPostingBot Test Task
// Developed by Yaroslav Volkivskyi (TheLaidSon)

// Actual v1.0

// Main File

import arch from "./base/architecture";
import Start from "./data/steps/Start";

async function main() {
  const [ onTextMessage, bot, db ] = await arch();

  await Start(bot, db);

  bot.launch();
}

main();