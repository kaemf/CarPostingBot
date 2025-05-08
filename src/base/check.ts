import Operation from "./operation";

class StandartCheckException{
  public VideoException(data: Operation): boolean {
    if (data.phone_number[0] === '' && data.photo[0] === '' && 
    data.text === '' && data.file[0] === '' && 
    data.stickers === '' && data.location[0] === -1 && 
    data.polls === '' && data.video[0] !== '' &&
    data.voice === '' && data.audio === '' && data.video_circle === ''){
      return true;
    }
    else return false;
  }

  public PhotoException(data: Operation): boolean {
    if (data.phone_number[0] === '' && data.text === '' && 
    data.file[0] === '' && data.stickers === '' && 
    data.video[0] === '' && data.polls === '' &&
    data.location[0] === -1 && data.photo[0] !== '' &&
    data.voice === '' && data.audio === '' && data.video_circle === ''){
      return true;
    }
    else return false;
  }

  public FileException(data: Operation): boolean {
    if (data.phone_number[0] === '' && data.photo[0] === '' && 
    data.text === '' && data.stickers === '' && 
    data.video[0] === '' && data.location[0] === -1 &&
    data.polls === '' && data.file[0] !== '' &&
    data.voice === '' && data.audio === '' && data.video_circle === ''){
      return true;
    }
    else return false;
  }

  public TextException(data: Operation): boolean {
    if (data.phone_number[0] === '' && data.photo[0] === '' && 
    data.file[0] === '' && data.stickers === '' && 
    data.video[0] === '' && data.location[0] === -1 &&
    data.polls === '' && data.text !== '' &&
    data.voice === '' && data.audio === '' && data.video_circle === ''){
      return true;
    }
    else return false;
  }

  public StickerException(data: Operation): boolean {
    if (data.phone_number[0] === '' && data.photo[0] === '' && 
    data.text === '' && data.file[0] === '' && 
    data.video[0] === '' && data.location[0] === -1 &&
    data.polls === '' && data.stickers !== '' &&
    data.voice === '' && data.audio === '' && data.video_circle === ''){
      return true;
    }
    else return false;
  }

  public LocationException(data: Operation): boolean {
    if (data.phone_number[0] === '' && data.photo[0] === '' && 
    data.text === '' && data.file[0] === '' && 
    data.video[0] === '' && data.stickers === '' &&
    data.polls === '' && data.location[0] !== -1 &&
    data.voice === '' && data.audio === '' && data.video_circle === ''){
      return true;
    }
    else return false;
  }

  public PollsException(data: Operation): boolean {
    if (data.phone_number[0] === '' && data.photo[0] === '' && 
    data.text === '' && data.file[0] === '' && 
    data.video[0] === '' && data.location[0] === -1 &&
    data.stickers === '' && data.polls !== '' &&
    data.voice === '' && data.audio === '' && data.video_circle === ''){
      return true;
    }
    else return false;
  }

  public PhoneException(data: Operation): boolean {
    if (data.phone_number[0] !== '' && data.photo[0] === '' && 
    data.text === '' && data.file[0] === '' && 
    data.video[0] === '' && data.location[0] === -1 &&
    data.stickers === '' && data.polls === '' &&
    data.voice === '' && data.audio === '' && data.video_circle === ''){
      return true;
    }
    else return false;
  }

  public AudioException(data: Operation): boolean {
    if (data.phone_number[0] === '' && data.photo[0] === '' && 
    data.text === '' && data.file[0] === '' && 
    data.video[0] === '' && data.location[0] === -1 &&
    data.stickers === '' && data.polls === '' &&
    data.voice === '' && data.audio !== '' && data.video_circle === ''){
      return true;
    }
    else return false;
  }

  public VideoNoteException(data: Operation): boolean {
    if (data.phone_number[0] === '' && data.photo[0] === '' && 
    data.text === '' && data.file[0] === '' && 
    data.video[0] === '' && data.location[0] === -1 &&
    data.stickers === '' && data.polls === '' &&
    data.voice === '' && data.audio === '' && data.video_circle !== ''){
      return true;
    }
    else return false;
  }

  public VoiceException(data: Operation): boolean {
    if (data.phone_number[0] === '' && data.photo[0] === '' && 
    data.text === '' && data.file[0] === '' && 
    data.video[0] === '' && data.location[0] === -1 &&
    data.stickers === '' && data.polls === '' &&
    data.voice !== '' && data.audio === '' && data.video_circle === ''){
      return true;
    }
    else return false;
  }

  public BackRoot(data: Operation){
    if (this.TextException(data) && data.text === '/back'){
      return true;
    }
    else return false;
  }

  public RegularButtons(keyboard: { text: string; }[][], input: string){
    return keyboard.flatMap((el: any) => el.map((el: any) => {return el.text})).includes(input);
  }
}

export const CheckException : StandartCheckException = new StandartCheckException();