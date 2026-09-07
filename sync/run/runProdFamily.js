const { runSync } = require('../orchestrator.js');

const config = require('../../config/ProdFamily.config.js');

runSync(config, 'Product Family')
    .then(result => {
        console.log('Product Family sync result:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('Error during Product Family sync:', error);
        process.exit(1);
    });

