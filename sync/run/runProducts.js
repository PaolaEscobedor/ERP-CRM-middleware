const { runSync } = require('../orchestrator.js');

const config = require('../../config/Products.config.js');

runSync(config, 'Products')
    .then(result => {
        console.log('Products sync result:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('Error during Products sync:', error);
        process.exit(1);
    });

