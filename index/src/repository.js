import { Sequelize, Model, Op } from 'sequelize'

const DATABASE = './database.sqlite'

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: DATABASE
})

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

sequelize.sync().then(async () => {
    Peer.findAll().then(console.log)
})

export async function registerPeer(peer) {
    let entity = await Peer.findOne({ where: { id: peer.id } })

    entity = entity ? await entity.update(peer) : await Peer.create(peer)

    Peer.findAll().then(console.log)
}

export async function retrieveFilePeers(fileId) {
    const peers = await Peer.findAll({ where: {
        files: {
            [Op.like]: '%' + fileId + '%',
        }
    } })

    return peers.map(({ id, ip, port }) => { return { id, ip, port } })
}
