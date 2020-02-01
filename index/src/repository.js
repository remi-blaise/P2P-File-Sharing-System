/**
 * repository.js
 *
 * Handle the persistence layer:
 * Communicate with the database to save and retrieve data.
 *
 * @author Rémi Blaise <hello@remi-blaise.com>
 */

import { Sequelize, Model, Op } from 'sequelize'
import config from './config'

// 1. Initiliaze the connexion with the database

// Location of the sqlite database
const DATABASE = './database.sqlite'

// Instanciate Sequelize ORM
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: DATABASE
})

// Define models
class Peer extends Model {}

Peer.init({
    id: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
    },
    ip: {
        type: Sequelize.STRING,
        allowNull: false
    },
    port: {
        type: Sequelize.SMALLINT,
        allowNull: false
    },
    files: {
        type: Sequelize.STRING,
        allowNull: false
    }
}, { sequelize })

// Start synchronization
sequelize.sync().then(async () => {
    // Print database content at start
    if (config.devMode) Peer.findAll().then(console.log)
})

/**
 * Save a peer
 * @param {Peer} peer - The peer
 * @return {Promise<null>}
 */
export async function registerPeer(peer) {
    // Check if the peer exists in the database
    let entity = await Peer.findOne({ where: { id: peer.id } })

    // If exists, update, else, create
    entity = entity ? await entity.update(peer) : await Peer.create(peer)

    // Print new database content
    if (config.devMode) Peer.findAll().then(console.log)
}

/**
 * Retrieve all peers having a file
 * @param {string} fileId - The file hash
 * @return {Promise<Peer[]>} peers - Found peers
 */
export async function retrieveFilePeers(fileId) {
    // Search for peers
    const peers = await Peer.findAll({ where: {
        files: {
            [Op.like]: '%' + fileId + '%',
        }
    } })

    // Return normalized data
    return peers.map(({ id, ip, port }) => { return { id, ip, port } })
}
