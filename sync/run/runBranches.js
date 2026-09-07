const { runSync } = require('../orchestrator.js');

const config = require('../../config/Branches.config.js');

runSync(config, 'Branches')
    .then(result => {
        console.log('Branches sync result:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('Error during Branches sync:', error);
        process.exit(1);
    });

