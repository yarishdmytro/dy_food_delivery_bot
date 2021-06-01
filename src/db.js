const mongoose = require('mongoose');
const config = require('./config');


mongoose.connect(config.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})

mongoose.connection.on('error', err => {
  console.log('Error', err);
});

