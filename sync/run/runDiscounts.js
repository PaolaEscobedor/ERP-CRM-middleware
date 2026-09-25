const { runSync } = require('../orchestrator.js');

const config = require('../../config/Discounts.config.js');

runSync(config, 'Sales Discounts')
    .then(result => {
        console.log('Sales Discounts sync result:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('Error during Sales Discounts sync:', error);
        process.exit(1);
    });

