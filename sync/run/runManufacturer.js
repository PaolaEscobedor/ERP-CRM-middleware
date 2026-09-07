const { runSync } = require('../orchestrator.js');

const config = require('../../config/Manufacturer.config.js');

runSync(config, 'Product Manufacturer')
    .then(result => {
        console.log('Product Manufacturer sync result:', result);
    })
    .catch(error => {
        console.error('Error during Product Manufacturer sync:', error);
    });

