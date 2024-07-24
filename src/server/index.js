import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import expressWs from 'express-ws';
import PubSubApiClient from 'salesforce-pubsub-api-client';
import axios from 'axios';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

// 現在のディレクトリ名を取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 環境変数を読み込む
dotenv.config();
const {
    SALESFORCE_LOGIN_URL,
    SALESFORCE_CLIENT_ID,
    SALESFORCE_CLIENT_SECRET,
    SALESFORCE_USERNAME,
    SALESFORCE_PASSWORD,
    SALESFORCE_TOKEN,
    SALESFORCE_USER_ID
} = process.env;

// 変更データキャプチャのトピック
const ORDER_CDC_TOPIC = '/data/Order__ChangeEvent';
// プラットフォームイベントのトピック
const MANUFACTURING_PE_TOPIC = '/event/Manufacturing_Event__e';

// Salesforceの認証エンドポイント
const SF_OAUTH_TOKEN_ENDPOINT = `${SALESFORCE_LOGIN_URL}/services/oauth2/token`;

// OAuthユーザー名・パスワードフローでSalesforceに認証
// NOTE: 設定 > OAuth および OpenID Connect 設定 > OAuth ユーザー名パスワードフローを許可
const getSalesforceToken = async () => {
    try {
        const response = await axios.post(SF_OAUTH_TOKEN_ENDPOINT, null, {
            params: {
                grant_type: 'password',
                client_id: SALESFORCE_CLIENT_ID,
                client_secret: SALESFORCE_CLIENT_SECRET,
                username: SALESFORCE_USERNAME,
                password: SALESFORCE_PASSWORD + SALESFORCE_TOKEN // セキュリティトークンが必要な場合は追加
            }
        });

        console.log(response);

        return {
            accessToken: response.data.access_token,
            instanceUrl: response.data.instance_url
        };
    } catch (error) {
        console.error(
            'Error authenticating with Salesforce:',
            error.response.data
        );
        res.status(500).json({
            error: 'Authentication failed'
        });
    }
};

(async () => {
    // Salesforce PubSub APIクライアントを作成
    const client = new PubSubApiClient();
    await client.connect();

    // Subscribe to opportunity change events
    const eventEmitter = await client.subscribe(ORDER_CDC_TOPIC);

    // expressアプリケーションを作成
    const app = express();
    expressWs(app);

    // WebSocketエンドポイントを作成
    app.ws('/ws', (ws, req) => {
        console.log('WebSocket connection established');

        // Handle incoming events
        eventEmitter.on('data', (event) => {
            console.log(
                `Handling ${event.payload.ChangeEventHeader.entityName} change event ` +
                    `with ID ${event.replayId} ` +
                    `on channel ${eventEmitter.getTopicName()} ` +
                    `(${eventEmitter.getReceivedEventCount()}/${eventEmitter.getRequestedEventCount()} ` +
                    `events received so far)`
            );
            // Safely log event as a JSON string
            console.log(
                JSON.stringify(
                    event,
                    (key, value) =>
                        /* Convert BigInt values into strings and keep other types unchanged */
                        typeof value === 'bigint' ? value.toString() : value,
                    2
                )
            );

            // イベント種別が「UPDATE」かつレコードのステータスが「Submitted to Manufacturing」
            if (
                event.payload.ChangeEventHeader.changeType === 'UPDATE' &&
                event.payload.Status__c === 'Submitted to Manufacturing'
            ) {
                // クライアントにメッセージを送信
                ws.send(
                    `{"recordIds": ${JSON.stringify(event.payload.ChangeEventHeader.recordIds)}}`
                );
            }

            // TODO: replayIdを保存してエラー時に再取得する
        });

        ws.on('message', async (msg) => {
            console.log('Received message:', msg);
            const msgObj = JSON.parse(msg);
            if (msgObj.status === 'Approved by Manufacturing') {
                const payload = {
                    CreatedDate: new Date().getTime(),
                    CreatedById: SALESFORCE_USER_ID,
                    Order_Id__c: { string: msgObj.recordId },
                    Status__c: { string: msgObj.status }
                };
                const publishResult = await client.publish(
                    MANUFACTURING_PE_TOPIC,
                    payload
                );
                console.log('Published event: ', JSON.stringify(publishResult));
            }
        });

        ws.on('close', () => {
            console.log('WebSocket connection closed');
        });
    });

    app.use(bodyParser.json());

    // REST APIで注文情報を取得
    app.get('/api/orders', async (req, res) => {
        const { recordId } = req.query;
        if (!recordId) {
            return res.status(400).json({ error: 'recordId is required' });
        }

        const soql = `SELECT Id, Name, Status__c,
	(
		SELECT Id, Name, Product__r.Name, Price__c, Qty_L__c, Qty_M__c, Qty_S__c
		FROM Order_Items__r
	)
FROM Order__c
WHERE Id = '${recordId}'
`;
        try {
            const { accessToken, instanceUrl } = await getSalesforceToken();

            const response = await axios.get(
                `${instanceUrl}/services/data/v52.0/query`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    },
                    params: {
                        q: soql
                    }
                }
            );

            res.json(response.data);
        } catch (error) {
            console.error('Error executing SOQL query:', error.response.data);
            res.status(500).json({
                error: 'Query execution failed'
            });
        }
    });

    // Reactのビルドディレクトリを静的ファイルとして提供
    app.use(express.static(path.join(__dirname, '../client/build')));
    // その他のリクエストはReactアプリのindex.htmlを返す
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname + '../client/build/index.html'));
    });

    // サーバーを起動
    const port = 3000;
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
})();
