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
class File extends Model {}

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
    }
}, { sequelize, modelName: 'peer' })

File.init({
    id: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
    },
    hash: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    size: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
}, { sequelize, modelName: 'file' })

Peer.belongsToMany(File, { through: 'Peer_File' })
File.belongsToMany(Peer, { through: 'Peer_File' })

async function logAllDatabase() {
    if (!config.logAllDatabase) return

    const logList = modelName => list => console.log(modelName, list.map(({ dataValues }) => dataValues))
    Peer.findAll({ include: [ File ] }).then(logList('Peers:'))
    File.findAll({ include: [ Peer ] }).then(logList('Files:'))
}

// Start synchronization
sequelize.sync().then(logAllDatabase)

/**
 * Save a peer
 * @param {Peer} peer - The peer
 * @return {Promise<null>}
 */
export async function registerPeer(peer) {
    // Check if the peer exists in the database
    let entity = await Peer.findOne({ where: { id: peer.id } })

    // If exists, update, else, create
    if (entity) {
        await entity.update(peer)
        const files = await Promise.all(peer.files.map(file => File.findOrCreate({ where: { id: file.id }, defaults: file })))
        await entity.setFiles(files.flatMap(([ file, _ ]) => file))
    } else {
        const files$ = Promise.all(peer.files.map(file => File.findOrCreate({ where: { id: file.id }, defaults: file })))
        const peer$ = Peer.create(peer)
        const setting$ = entity.setFiles(files.flatMap(([ file, _ ]) => file))
        await Promise.all([files$, peer$, setting$])
    }

    // Print new database content
    logAllDatabase()
}

/**
 * Retrieve all peers having a file
 * @param {string} fileId - The file hash
 * @return {Promise<Peer[]>} peers - Found peers
 */
export async function retrieveFiles(fileName) {
    // Search for files
    let files = await File.findAll({ where: { name: { [Op.like]: `%${fileName}%` } }, include: [ Peer ] })

    // Remove unavailable files
    files = files.filter(file => file.peers.length)

    // Return normalized data
    return files.map(({ id, hash, name, size, peers }) => {
        return { id, hash, name, size, peers: peers.map(({ id, ip, port }) => { return { id, ip, port } }) }
    })
}
