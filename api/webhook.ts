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

interface ReplyToMessageFrom {
    id: number,
}

interface ReplyToMessage {
    message_id: number,
    from: ReplyToMessageFrom,
}

interface Chat {
    id: number,
    type: string,
}

interface Message {
    chat: Chat,
    text: string,
    message_id: number,
    reply_to_message: ReplyToMessage,
}

function isReplyToMe(reply_to_message: ReplyToMessage): boolean {
    const self_id = parseInt(process.env.TELEGRAM_TOKEN?.split(':')[0]!!);
    return reply_to_message?.from?.id == self_id;
}

export default async ({ body }, response) => {
    try {
        const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);
        let { chat: { id, type }, text, message_id, reply_to_message } = body.message;
        const isFromGroupChat = type === 'group' || type == 'supergroup';
        if (isFromGroupChat && !text.startsWith('@MFGWBot') && !isReplyToMe(reply_to_message)) {
            response.status(200).send('Group message not aim to me');
            return;
        } else if (isFromGroupChat) {
            text = text.replace('@MFGWBot', '').trim();
        }
        let style = "";
        if (text.startsWith('/creative')) {
            style = 'creative';
            text = text.replace('/creative', '').trim();
        } else if (text.startsWith('/balanced')) {
            style = 'balanced';
            text = text.replace('/balanced', '').trim();
        } else if (text.startsWith('/precise')) {
            style = 'precise';
            text = text.replace('/precise', '').trim();
        }
        await send_request(id, style, message_id, reply_to_message?.message_id, text);
        response.status(200).send('Message received');
    } catch (e) {
        console.error(e);
        response.status(200).send('');
    }
}

const message_file_url = 'https://api.github.com/repos/baipiao-bot/action-ask-bing/contents/request.json.encrypted';
async function send_request(chat_id: number, style: string, message_id: number, reply_to_message_id: number | null, text: string) {
    const file_content = {
        "chat_id": chat_id,
        "reply_to_message_id": reply_to_message_id,
        "message_id": message_id,
        "question": text,
        "style": style
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
