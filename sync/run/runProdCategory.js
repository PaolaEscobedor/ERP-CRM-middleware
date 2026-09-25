const { runSync } = require('../orchestrator.js');

const config = require('../../config/ProdCategory.config.js');

runSync(config, 'Product Category')
    .then(result => {
        console.log('Product Category sync result:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('Error during Product Category sync:', error);
        process.exit(1);
    });

