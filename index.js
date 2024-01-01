
const net = require('net');
const argv = require('minimist')(process.argv.slice(2));
const socketio = require('socket.io-client');
const JSONdb = require('simple-json-db');
const server = 'tunnel.elainateam.io'
const db = new JSONdb('./elainatunnel.json');
const colors = require('colors');
const transactions = {};
if (argv._[0] == 'config') {
    if (argv._[1] == 'token') {
        if (!argv._[2]) return console.log(colors.red(`[ERR]: Not enough args`));
        db.set('token', argv._[2]);
        console.log(colors.green(`[OK]: Set your token`));
        return process.exit();
    } else {
        console.log(colors.red(`[ERR]: Unknown choice`));
    }
} else if (argv._[0] == 'forward') {
    const local = argv._[1]
    const host = local.split(':')[0] || '127.0.0.1'
    const port = local.split(':')[1] || 80
    const forwardPort = argv._[2]
    if (!port) return console.log(colors.red(`[ERR]: Not enough args`));
    const socket = socketio(`ws://${server}:8888`, {
        cors: {
            origin: "*",
        },
    });
    socket.emit('tunnelReady', {
        token: db.get('token'),
        port,
        forwardPort
    });
    socket.on('error', (data) => {
        console.log(colors.red(`[ERR]: ${data.msg}`));
        if (data.exit) return process.exit()
    });
    socket.on('tunnelReady', (data) => {
        console.log(colors.green(`[OK]: Forwarding ${host}:${port} -> ${server}:${data.port}`));
    });

    socket.on('event', ({ data, transId }) => {
        if (!transactions[transId]) {
            const client = new net.Socket();
            client.connect(port, host, function () {
                client.write(data);
            });
            client.on('data', function (clientData) {
                client.setKeepAlive(true, 1000)
                socket.emit(`event-${transId}`, clientData);
            });

            client.on('error', (e) => {
                console.log(colors.red(`[ERR]: ${e.code}`));
            });

            client.on('close', function () {
                client.destroy();
            });
            transactions[transId] = { socket, client };
        } else {
            const { client } = transactions[transId];
            client.write(data);
        }
    });
} else {
    console.log(colors.red(`[ERR]: Unknown choice`));
    return process.exit();
}