// CarPostingBot Test Task
// Developed by Yaroslav Volkivskyi (TheLaidSon)

// Actual v1.0

// Main File

import arch from "./base/architecture";
import Start from "./data/steps/Start";
import BeginHandler from "./data/steps/BeginHandler";

async function main() {
  const [ onTextMessage, bot, db ] = await arch();

  await Start(bot, db);

  await BeginHandler(onTextMessage, db);

  bot.launch();
}

main();