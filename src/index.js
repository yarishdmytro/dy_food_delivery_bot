require('./db');
require('./models/meal.model');
require('./models/user.model');
const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const helper = require('./helper');
const mongoose = require('mongoose');
const keyboard = require('./keyboard');
const kb = require('./keyboard-buttons');
const mock_database = require('../food_db.json');

helper.logStart();

const Meal = mongoose.model('meals');
// mock_database.meals.forEach(f => new Meal(f).save())


const User = mongoose.model('users');

const ACTION_TYPE = {
  TOGGLE_CART_MEAL: 'tcm'
}



//=======================================================
const bot = new TelegramBot(config.TOKEN, {
  polling: true
});



bot.on('message', msg => {
  console.log('Working', msg.from.first_name);
  const chatId = helper.getChatId(msg);

  switch (msg.text) {
    case kb.home.cart:
      showAddedMeals(chatId, msg.from.id)
      break;

    case kb.home.menus:
      bot.sendMessage(chatId, `Оберіть бажану категорію:`, {
        reply_markup: {keyboard: keyboard.menus}
      })
      break;
    
    case kb.menu.pizza:
      sendMealsByQuery(chatId, {type: 'pizza'})
      break

    case kb.menu.salad:
      sendMealsByQuery(chatId, {type: 'salad'})
      break

    case kb.menu.desert:
      sendMealsByQuery(chatId, {type: 'desert'})
      break

    case kb.menu.drink:
      sendMealsByQuery(chatId, {type: 'drink'})
      break    

    case kb.home.termsOfDelivery:
      bot.sendMessage(chatId, `<b>Ввічливі кур’єри Italiano Pizza привозять смачні та якісні страви. Просимо ознайомитись з умовами доставки у нашій компанії:</b>\n 1. Замовлення приймаються  24/7.\n 2. Доставка безкоштовна. Досить витрачати зайві кошти – економте на ціні, а не на якості.\n 3. Мінімальне замовлення від 200 грн.\n 4. Комфортні замовлення. Обрати піцу та інші страви можна через бот, форму на сайті, чи подзвонивши по телефону. Зручніше не буває!\n 5. Доставка за місто. Дізнатися про умови такої послуги можна в оператора. Ми пропонуємо лояльні тарифи. \n 6. Попереднє замовлення на будь-який день чи час. Тепер дешева піца у Львові доставляється у потрібний момент без запізнень та зайвих очікувань. \n7. Зручна система оплати. Оплата карткою чи готівкою при отриманні замовлення – вирішувати вам.`, {
        parse_mode: 'HTML',
        reply_markup: {keyboard: keyboard.home}
      })
      break;

    case kb.back:
      bot.sendMessage(chatId, `Назад`, {
        reply_markup: {keyboard: keyboard.home}
      })
      break;
  }
});

// start bot
bot.onText(/\/start/, msg => {
  const text = `Привіт, ${msg.from.first_name}!\nВас вітає бот доставки Italiano Pizza Bot. Саме час смачно поїсти!\nСкористайтесь нашим меню , і оформіть замовлення за лічені хвилини!`
  bot.sendMessage(helper.getChatId(msg), text, {
    reply_markup: {
      keyboard: keyboard.home
    }
  })
})

bot.onText(/\/m(.+)/, (msg, [source, match]) => {

  const mealUuid = helper.getItemUuid(source)
  const chatId = helper.getChatId(msg)

  Promise.all([
    Meal.findOne({uuid: mealUuid}),
    User.findOne({telegramId: msg.from.id})
  ]).then(([meal, user]) => {

    let isAdd = false;

    if (user) {
      isAdd = user.meals.indexOf(meal.uuid) !== -1
    }

    const addToCartText = isAdd ? 'Видалити з корзини': 'Добавити в корзину'

    const caption = `Назва: ${meal.name}\nОпис: ${meal.description}\nВага: ${meal.weight}\nЦіна: ${meal.price}грн`


    bot.sendPhoto(chatId, meal.picture, {
      caption: caption,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: addToCartText,
              callback_data: JSON.stringify({
                type: ACTION_TYPE.TOGGLE_CART_MEAL,
                mealUuid: meal.uuid,
                isAdd: isAdd
              })
            }
          ]
        ]
      }
    })
  })
})

bot.on('callback_query', query => {
  const userId = query.from.id;
  let data;
  try {
    data = JSON.parse(query.data)
  } catch (error) {
    throw new Error('Data is not an object')
  }

  const { type } = data

  if (type === ACTION_TYPE.TOGGLE_CART_MEAL) {
    toggleAddToCardMeal(userId, query.id, data)
  }
})

// ================================================

function sendMealsByQuery(chatId, query) {
  Meal.find(query).then(meals => {
    const html = meals.map((meal, index) => {
      return `<b>${index + 1}</b> ${meal.name} - /m${meal.uuid}`
    }).join('\n')

    sendHTML(chatId, html, 'home')
  })
}

function sendHTML(chatId, html, kbName = null) {
  const options = {
    parse_mode: 'HTML'
  }

  if (kbName) {
    options['reply_markup'] = {
      keyboard: keyboard[kbName]
    }
  }

  bot.sendMessage(chatId, html, options)
}

function toggleAddToCardMeal(userId, queryId, {mealUuid, isAdd}) {
  
  let userPromise

  User.findOne({telegramId: userId})
  .then(user => {
    if (user) {
      if (isAdd) {
        user.meals = user.meals.filter(mUuid => mUuid !== mealUuid)
      } else {
        user.meals.push(mealUuid)
      }
      userPromise = user
    } else {
      userPromise = new User({
        telegramId: userId,
        meals: [mealUuid]
      })
    }

    const answerText = isAdd ? 'Видаленно з корзини' : 'Добавлено в корзину'

    userPromise.save().then(_ => {
      bot.answerCallbackQuery({
        callback_query_id: queryId,
        text: answerText
      })
    }).catch(error => console.log(error))

  }).catch(error => console.log(error))

}

function showAddedMeals(chatId, telegramId) {
  User.findOne({telegramId: telegramId})
  .then( user => {

    if (user) {
      Meal.find({uuid: {'$in': user.meals}})
      .then(meals => {
        let html

        if (meals.length) {
          items = meals.map((meal, index) => {
            return `<b>${index + 1}</b> ${meal.name} - <b>${meal.price} грн</b>`
          }).join('\n')

          let totalPrice = 0
          let sum = meals.map((meal, index) => {
            totalPrice += meal.price
          }).join('\n');
          

          html = items + `\n<b><i>Загальна сума: ${totalPrice}грн</i></b>\n`;
          bot.sendMessage(chatId, html, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Оформити замовлення',
                    callback_data: '1'
                  }
                ]
              ]
            },
            keyboard: keyboard['home']


          })
        
        } else {
          html = 'Ваша корзина пуста'
          sendHTML(chatId, html, 'home')
        }


      })
    } else {
      sendHTML(chatId, 'Ваша корзина пуста, перейдіть в меню щоб додати товари в корзину', 'home')
    }

  })
}
