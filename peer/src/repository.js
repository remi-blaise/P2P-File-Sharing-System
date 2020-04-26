import Sequelize from 'sequelize'

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'database.sqlite',
    transactionType: 'IMMEDIATE',
    logging: false
})

const File = sequelize.define('file', {
    name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    version: {
        type: Sequelize.NUMBER,
        allowNull: false,
        defaultValue: 1
    },
    owned: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },

    // Origin address if not owned
    ip: {
        type: Sequelize.STRING
    },
    port: {
        type: Sequelize.NUMBER
    },
    valid: {
        type: Sequelize.BOOLEAN
    }
})

sequelize.sync()

export default { sequelize, File }
