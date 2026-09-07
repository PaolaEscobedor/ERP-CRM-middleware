const { runSync } = require('../orchestrator.js');

const config = require('../../config/ProdGroup.config.js');

runSync(config, 'Product Group')
    .then(result => {
        console.log('Product Group sync result:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('Error during Product Group sync:', error);
        process.exit(1);
    });

