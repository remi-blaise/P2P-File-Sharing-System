var keys = {}

function getKey(id) {
    return keys[id]
}

function setKey(id, key) {
    keys[id] = key
}

export default { getKey, setKey }
