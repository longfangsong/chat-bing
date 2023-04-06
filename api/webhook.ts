const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

function encrypt(secret: string, data: string): string {
    const key = Buffer.from(secret.slice(0, 32 * 2), "hex");
    const iv = Buffer.from(secret.slice(32 * 2, (32 + 16) * 2), "hex");
    const cipher = crypto.createCipheriv("AES-256-CBC", key, iv);
    let result = cipher.update(data, "utf-8", "hex");
    result += cipher.final("hex");
    return result;
}


export default async ({ body }, response) => {
    try {
        const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);
        let { chat: { id, type }, text, message_id, reply_to_message } = body.message;
        if ((type === 'group' || type == 'supergroup') && !text.startsWith('@MFGWBot')) {
            response.status(200).send('Group message not aim to me');
            return;
        } else if (type === 'group' || type == 'supergroup') {
            text = text.replace('@MFGWBot', '').trim();
        }
        await send_request(id, message_id, reply_to_message?.message_id, text);
        response.status(200).send('Message received');
    } catch (e) {
        console.error(e);
        response.status(200).send('');
    }
}

const message_file_url = 'https://api.github.com/repos/longfangsong/action-ask-bing/contents/request.json.encrypted';
async function send_request(chat_id: number, message_id: number, reply_to_message_id: number | null, text: string) {
    const file_content = {
        "chat_id": chat_id,
        "reply_to_message_id": reply_to_message_id,
        "message_id": message_id,
        "question": text
    };
    const currentFileInfoResponse = await fetch(message_file_url, {
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
            'X-GitHub-Api-Version': '2022-11-28'
        }
    });
    const currentFileInfo = await currentFileInfoResponse.json();
    const currentFileSha = currentFileInfo['sha'];
    const content_str = encrypt(process.env.SECRET!!, JSON.stringify(file_content));
    console.log(content_str);
    const response = await fetch(message_file_url, {
        method: 'PUT',
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
            'X-GitHub-Api-Version': '2022-11-28'
        },
        body: `{"message":"send request","committer":{"name":"longfangsong","email":"longfangsong@icloud.com"},"content":"${Buffer.from(content_str).toString('base64')}","sha":"${currentFileSha}"}`
    });
}
