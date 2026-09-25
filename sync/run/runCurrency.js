const { runSync } = require('../orchestrator.js');

const config = require('../../config/Currency.config.js');

runSync(config, 'Currency')
    .then(result => {
        console.log('Currency sync result:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('Error during Currency sync:', error);
        process.exit(1);
    });

