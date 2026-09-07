const { runSync } = require('../orchestrator.js');

const config = require('../../config/PriceBooks.config.js');

runSync(config, 'Price Books')
    .then(result => {
        console.log('Price Books sync result:', result);
    })
    .catch(error => {
        console.error('Error during Price Books sync:', error);
    });

