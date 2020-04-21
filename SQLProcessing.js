'use strict';
const Connection = require('tedious').Connection;
const Request = require('tedious').Request;
const TYPES = require('tedious').TYPES;
const config = require('config');
const Promise = require('bluebird');

const params = {
    userName: config.DB.username,
    password: config.DB.password,
    server: config.DB.host,
    options: { database: config.DB.database, encrypt: true }
};

const fnSaveDialog = (query, question, answer, source, area_code) => {
    return new Promise((resolve, reject) => {
        const connection = new Connection(params);

        connection.on('connect', function(err) {
            if (err) {
                return reject("SQL connection error");
            }

            const insert = new Request(
                'INSERT INTO faq_dialogs (query, question, answer, source, area_code, created) VALUES (@query, @question, @answer, @source, @area_code, @created)', (err) => {
                    if (err) {
                        connection.close();
                        return reject('SQL error.');
                    }
                }
            );

            insert.addParameter('query', TYPES.NVarChar, query);
            insert.addParameter('question', TYPES.NVarChar, question || null);
            insert.addParameter('answer', TYPES.NVarChar, answer);
            insert.addParameter('source', TYPES.NVarChar, source);
            insert.addParameter('area_code', TYPES.NVarChar, area_code);
            insert.addParameter('created', TYPES.DateTime, new Date());

            insert.on('row', function(columns) {
                resolve(columns[0].value);
                connection.close();
            });

            connection.execSql(insert);
        });
    });
};

module.exports.saveDialog = fnSaveDialog;