type ReplyOptions = {
  parse_mode: "Markdown" | "MarkdownV2" | "HTML";
  reply_markup: {
    keyboard: { text: string }[][];
    resize_keyboard?: boolean;
    one_time_keyboard?: boolean;
    selective?: boolean;
    is_persistent?: boolean;
    input_field_placeholder?: string;
  };
};

class Keyboard{
    
    yesNo(): ReplyOptions{
        return {
            parse_mode: 'HTML',
            reply_markup: {
                keyboard: [
                    [{ text: 'Да' }, { text: 'Нет' }]
                ]
            }
        }
    }
    
}

export default new Keyboard();