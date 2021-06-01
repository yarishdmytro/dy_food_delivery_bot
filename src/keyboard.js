const kb = require('./keyboard-buttons')

module.exports = {
  home: [
    [kb.home.menus, kb.home.termsOfDelivery],
    [kb.home.cart]
  ],
  menus: [
    [kb.menu.pizza, kb.menu.salad],
    [kb.menu.desert, kb.menu.drink],
    [kb.back]
  ]
}