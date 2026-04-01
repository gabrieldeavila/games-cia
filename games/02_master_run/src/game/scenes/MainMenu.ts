import { GameObjects, Scene } from 'phaser';

import { EventBus } from '../EventBus';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;
    logoTween: Phaser.Tweens.Tween | null;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        const width = this.scale.width;
        const height = this.scale.height;

        this.background = this.add.image(0, 0, 'starting_image');
        const originalWidth = this.background.width;
        const originalHeight = this.background.height;

        const setBackgroundSize = (w: number, h: number) => {
            if (originalWidth > 0 && originalHeight > 0) {
                const scale = Math.max(w / originalWidth, h / originalHeight);
                this.background.setDisplaySize(originalWidth * scale, originalHeight * scale);
                this.background.setPosition(w / 2, h / 2).setOrigin(0.5);
            } else {
                this.background.setOrigin(0).setDisplaySize(w, h);
            }
        };

        setBackgroundSize(width, height);

        this.title = this.add.text(width / 2, height * 0.25, 'Ready to become the master of puppets?', {
            fontFamily: 'Arial Black',
            fontSize: Math.floor(Math.max(24, width * 0.04)),
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center',
            wordWrap: { width: Math.floor(width * 0.8), useAdvancedWrap: true },
        })
            .setOrigin(0.5)
            .setDepth(100);

        const readyButton = this.add
            .text(width / 2, height * 0.45, '<< READY >>', {
                fontFamily: 'Arial Black',
                fontSize: Math.floor(Math.max(30, width * 0.05)),
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 10,
            })
            .setOrigin(0.5)
            .setDepth(100)
            .setInteractive({ useHandCursor: true });

        readyButton.on('pointerover', () => {
            readyButton.setStyle({ color: '#ffcc00' });
        });

        readyButton.on('pointerout', () => {
            readyButton.setStyle({ color: '#ffff00' });
        });

        readyButton.on('pointerdown', () => {
            this.scene.start('Game');
        });

        this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
            const newWidth = gameSize.width;
            const newHeight = gameSize.height;

            this.cameras.main.setBounds(0, 0, newWidth, newHeight);
            setBackgroundSize(newWidth, newHeight);
            this.title.setPosition(newWidth / 2, newHeight * 0.25);
            readyButton.setPosition(newWidth / 2, newHeight * 0.45);
        });

        EventBus.emit('current-scene-ready', this);
    }
    
    changeScene ()
    {
        if (this.logoTween)
        {
            this.logoTween.stop();
            this.logoTween = null;
        }

        this.scene.start('Game');
    }

    moveLogo (vueCallback: ({ x, y }: { x: number, y: number }) => void)
    {
        if (this.logoTween)
        {
            if (this.logoTween.isPlaying())
            {
                this.logoTween.pause();
            }
            else
            {
                this.logoTween.play();
            }
        } 
        else
        {
            this.logoTween = this.tweens.add({
                targets: this.logo,
                x: { value: 750, duration: 3000, ease: 'Back.easeInOut' },
                y: { value: 80, duration: 1500, ease: 'Sine.easeOut' },
                yoyo: true,
                repeat: -1,
                onUpdate: () => {
                    if (vueCallback)
                    {
                        vueCallback({
                            x: Math.floor(this.logo.x),
                            y: Math.floor(this.logo.y)
                        });
                    }
                }
            });
        }
    }
}
