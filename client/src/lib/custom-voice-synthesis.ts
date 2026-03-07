// Custom voice synthesis using pre-recorded audio files
export interface VoiceOption {
  name: string;
  directory: string;
  displayName: string;
}

export class CustomBingoVoiceSynthesis {
  private voices: VoiceOption[] = [];
  private selectedVoice: VoiceOption | null = null;
  private volume: number = 1.0;
  private currentAudio: HTMLAudioElement | null = null;
  private preloadedAudio: Map<string, HTMLAudioElement> = new Map();

  constructor() {
    this.loadVoices();
    this.preloadVoiceAssets();
  }

  private loadVoices() {
    // Define available voice characters based on directory structure
    // Only include voices that have bingo number files
    this.voices = [
      { name: 'arada', directory: 'arada', displayName: 'Arada' },
      { name: 'betty', directory: 'betty', displayName: 'Betty' },
      { name: 'female1', directory: 'female1', displayName: 'Female 1' },
      { name: 'melat2', directory: 'melat2', displayName: 'Melat 2' },
      { name: 'nati', directory: 'nati', displayName: 'Nati' },
      { name: 'nigus', directory: 'nigus', displayName: 'Nigus' },
      { name: 'oromifa', directory: 'oromifa', displayName: 'Oromifa' },
      { name: 'real-arada', directory: 'real-arada', displayName: 'Real Arada' },
      { name: 'tigrigna', directory: 'tigrigna', displayName: 'Tigrigna' },
    ];

    // Select default voice (arada has complete bingo number set)
    this.selectedVoice = this.voices.find(v => v.name === 'arada') || this.voices[0];
  }

  // Preload all voice assets for zero lag
  private async preloadVoiceAssets() {
    const preloadPromises: Promise<void>[] = [];

    // Preload common sounds
    const commonSounds = ['winner.mp3', 'not_winner_cartela.mp3', 'start_game.mp3', 'stop_game.mp3', 'shuffle.mp3', 'disqualified.mp3', 'not_registered.wav'];
    
    commonSounds.forEach(fileName => {
      const filePath = this.getAssetPath(`voices/common/${fileName}`);
      const audio = new Audio(filePath);
      audio.preload = 'auto';
      this.preloadedAudio.set(`common/${fileName}`, audio);
    });

    // Preload numbers for default voice (1-75)
    if (this.selectedVoice) {
      for (let i = 1; i <= 75; i++) {
        const filePath = this.getNumberFilePath(i);
        const audio = new Audio(filePath);
        audio.preload = 'auto';
        this.preloadedAudio.set(`${this.selectedVoice.name}/${i}`, audio);
      }
    }

    // Try to load all audio files
    await Promise.allSettled(preloadPromises);
  }

  // Get asset path using custom protocol if available
  private getAssetPath(relativePath: string): string {
    // Check if running in Electron
    if (typeof window !== 'undefined' && window.electronAPI) {
      return window.electronAPI.getAssetPath(relativePath);
    }
    
    // Fallback for web development
    return `/${relativePath}`;
  }

  getAvailableVoices(): VoiceOption[] {
    return this.voices;
  }

  setVoice(voice: VoiceOption) {
    this.selectedVoice = voice;
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.currentAudio) {
      this.currentAudio.volume = this.volume;
    }
  }

  getCurrentVoice(): VoiceOption | null {
    return this.selectedVoice;
  }

  getVolume(): number {
    return this.volume;
  }

  // Stop any currently playing audio
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  // Play audio file
  private async playAudioFile(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stop(); // Stop any currently playing audio immediately

      // Try to use preloaded audio first
      const audioKey = this.getAudioKeyFromPath(filePath);
      let audio = this.preloadedAudio.get(audioKey);

      if (!audio) {
        // Fallback to creating new audio if not preloaded
        audio = new Audio(filePath);
      }

      audio.volume = this.volume;
      
      audio.onended = () => {
        this.currentAudio = null;
        resolve();
      };
      
      audio.onerror = (error) => {
        this.currentAudio = null;
        console.warn(`Audio file not found or failed to load: ${filePath}`);
        // Resolve instead of reject to allow game to continue without audio
        resolve();
      };

      this.currentAudio = audio;
      audio.play().catch((error) => {
        this.currentAudio = null;
        console.warn(`Failed to play audio file: ${filePath}`, error);
        // Resolve instead of reject to allow game to continue
        resolve();
      });
    });
  }

  // Get audio key from file path for preloaded audio lookup
  private getAudioKeyFromPath(filePath: string): string {
    // Extract voice/number from path like "app-resource://voices/arada/B1.mp3"
    const match = filePath.match(/voices\/([^\/]+)\/(.+)$/);
    if (match) {
      const [, voiceDir, fileName] = match;
      
      // Check if it's a common sound
      if (voiceDir === 'common') {
        return `common/${fileName}`;
      }
      
      // Check if it's a number file
      const numberMatch = fileName.match(/^[A-Z]?(\d+)\./);
      if (numberMatch) {
        const number = parseInt(numberMatch[1]);
        return `${voiceDir}/${number}`;
      }
    }
    
    return filePath;
  }

  // Get the voice name for a directory
  private getVoiceNameFromDirectory(directory: string): string | null {
    const voice = this.voices.find(v => v.directory === directory);
    return voice ? voice.name : null;
  }

  // Get the file path for a specific number
  private getNumberFilePath(number: number): string {
    if (!this.selectedVoice) {
      throw new Error('No voice selected');
    }

    // Special handling for 'nigus' voice which uses simple numbering (1.wav, 2.wav, etc.)
    if (this.selectedVoice.name === 'nigus') {
      return this.getAssetPath(`voices/${this.selectedVoice.directory}/${number}.wav`);
    }

    // Standard bingo format for other voices (B1.mp3, I16.mp3, etc.)
    const letter = this.getLetterForNumber(number);
    const fileName = `${letter}${number}.mp3`;
    return this.getAssetPath(`voices/${this.selectedVoice.directory}/${fileName}`);
  }

  // Get the file path for common sounds
  private getCommonFilePath(fileName: string): string {
    return this.getAssetPath(`voices/common/${fileName}`);
  }

  // Speak a number using pre-recorded audio
  async callNumber(number: number): Promise<void> {
    try {
      const filePath = this.getNumberFilePath(number);
      await this.playAudioFile(filePath);
    } catch (error) {
      console.warn('Error calling number:', error);
      // Don't throw error - allow game to continue silently
    }
  }

  // Announce winner using pre-recorded audio
  async announceWinner(cartelaNumber: number, isWinner: boolean): Promise<void> {
    try {
      if (isWinner) {
        // Play winner announcement
        await this.playAudioFile(this.getCommonFilePath('winner.mp3'));
      } else {
        // Play not winner announcement
        await this.playAudioFile(this.getCommonFilePath('not_winner_cartela.mp3'));
      }
    } catch (error) {
      console.warn('Error announcing winner:', error);
      // Don't throw error - allow game to continue silently
    }
  }

  // Announce game start using pre-recorded audio
  async announceGameStart(): Promise<void> {
    try {
      await this.playAudioFile(this.getCommonFilePath('start_game.mp3'));
    } catch (error) {
      console.warn('Error announcing game start:', error);
      // Don't throw error - allow game to continue silently
    }
  }

  // Announce game end using pre-recorded audio
  async announceGameEnd(): Promise<void> {
    try {
      await this.playAudioFile(this.getCommonFilePath('stop_game.mp3'));
    } catch (error) {
      console.warn('Error announcing game end:', error);
      // Don't throw error - allow game to continue silently
    }
  }

  // Play shuffle sound
  async playShuffle(): Promise<void> {
    try {
      await this.playAudioFile(this.getCommonFilePath('shuffle.mp3'));
    } catch (error) {
      console.warn('Error playing shuffle sound:', error);
      // Don't throw error - allow game to continue silently
    }
  }

  // Play disqualified sound
  async playDisqualified(): Promise<void> {
    try {
      await this.playAudioFile(this.getCommonFilePath('disqualified.mp3'));
    } catch (error) {
      console.warn('Error playing disqualified sound:', error);
      // Don't throw error - allow game to continue silently
    }
  }

  // Play not registered sound
  async playNotRegistered(): Promise<void> {
    try {
      await this.playAudioFile(this.getAssetPath('voices/common/not_registered.wav'));
    } catch (error) {
      console.warn('Error playing not registered sound:', error);
      // Don't throw error - allow game to continue silently
    }
  }

  // Test voice with a sample number
  async testVoice(): Promise<void> {
    try {
      // Test with N25 (middle number)
      await this.callNumber(25);
    } catch (error) {
      console.warn('Error testing voice:', error);
      // Don't throw error - allow game to continue silently
    }
  }

  // Check if audio file exists for a number
  async hasAudioFile(number: number): Promise<boolean> {
    if (!this.selectedVoice) return false;

    try {
      const filePath = this.getNumberFilePath(number);
      const response = await fetch(filePath, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  private getLetterForNumber(num: number): string {
    if (num >= 1 && num <= 15) return "B";
    if (num >= 16 && num <= 30) return "I";
    if (num >= 31 && num <= 45) return "N";
    if (num >= 46 && num <= 60) return "G";
    if (num >= 61 && num <= 75) return "O";
    return "";
  }
}

// Singleton instance
export const customBingoVoice = new CustomBingoVoiceSynthesis();
