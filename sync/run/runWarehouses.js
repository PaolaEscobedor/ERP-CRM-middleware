const { runSync } = require('../orchestrator.js');

const config = require('../../config/Warehouses.config.js');

runSync(config, 'Warehouses')
    .then(result => {
        console.log('Warehouses sync result:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('Error during Warehouses sync:', error);
        process.exit(1);
    });

