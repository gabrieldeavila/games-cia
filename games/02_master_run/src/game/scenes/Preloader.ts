import { Scene } from "phaser";

export class Preloader extends Scene {
    constructor() {
        super("Preloader");
    }

    init() {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        this.add
            .rectangle(centerX, centerY, 468, 32)
            .setStrokeStyle(1, 0xffffff);

        // Subtraímos metade da largura total da barra (460/2 = 230) para alinhar à esquerda do centro
        const bar = this.add.rectangle(centerX - 230, centerY, 4, 28, 0xffffff);

        this.load.on("progress", (progress: number) => {
            // Atualiza a largura baseada no progresso (0 a 1)
            bar.width = 4 + 460 * progress;
        });
    }

    preload() {
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath("assets");

        this.load.image("logo", "logo.png");
        this.load.image("star", "star.png");

        this.load.tilemapTiledJSON("mapa_start", "map/level_agiota_start.json");
        this.load.image("tilemap-color1", "map/Tilemap_color1.png");
        this.load.image("terrain-tiles", "terrain.png");
        this.load.image("blue-img", "map/Water Background color.png");

        this.load.spritesheet("xp", "vorc/xp.png", {
            frameWidth: 51,
            frameHeight: 48,
        });
        this.load.spritesheet("sugar", "vorc/sugar.png", {
            frameWidth: 49,
            frameHeight: 48,
        });
        this.load.spritesheet("republica", "vorc/republica.png", {
            frameWidth: 69,
            frameHeight: 70,
        });

        this.load.spritesheet("strawberry", "Strawberry.png", {
            frameWidth: 32,
            frameHeight: 32,
        });

        this.load.spritesheet("water_foam", "map/Water Foam.png", {
            frameWidth: 192,
            frameHeight: 192,
        });

        this.load.spritesheet("finish", "End (Idle).png", {
            frameWidth: 64,
            frameHeight: 64,
        });

        this.load.spritesheet("collected", "Collected.png", {
            frameWidth: 32,
            frameHeight: 32,
        });

        this.load.image("dust", "Dust Particle.png");

        // 4. O Spritesheet do Player (Sapinho/Mascarado)
        this.load.spritesheet("player_buy", "vorc/buy.png", {
            frameWidth: 196 / 6, // Ajuste para a largura real do arquivo gangsta.png
            frameHeight: 45,
        });

        this.load.spritesheet("player_idle", "vorc/idle.png", {
            frameWidth: 297 / 9, // Ajuste para a largura real do arquivo gangsta.png
            frameHeight: 45,
        });
        this.load.spritesheet("player_run", "vorc/run.png", {
            frameWidth: 226 / 6,
            frameHeight: 45,
        });
        this.load.spritesheet("player_jump", "vorc/jump.png", {
            frameWidth: 33,
            frameHeight: 45,
        });
        this.load.spritesheet("player_fall", "vorc/fall.png", {
            frameWidth: 33,
            frameHeight: 45,
        });

        this.load.spritesheet("coin", "vorc/coin.png", {
            frameWidth: 62,
            frameHeight: 56,
        });

        this.load.spritesheet(
            "player_wall_jump",
            "ninja/Wall Jump (32x32).png",
            {
                frameWidth: 32,
                frameHeight: 32,
            },
        );
        this.load.spritesheet(
            "player_double_jump",
            "ninja/Double Jump (32x32).png",
            {
                frameWidth: 32,
                frameHeight: 32,
            },
        );

        this.load.spritesheet("rock", "decorations/Rock1.png", {
            frameWidth: 64,
            frameHeight: 64,
        });

        this.load.spritesheet("rock2", "decorations/Rock2.png", {
            frameWidth: 64,
            frameHeight: 64,
        });

        this.load.spritesheet("bank", "decorations/bank.png", {
            frameWidth: 300,
            frameHeight: 415,
        });

        this.load.spritesheet("tree", "decorations/Tree1.png", {
            frameWidth: 1536 / 8,
            frameHeight: 256,
        });

        this.load.spritesheet("tree2", "decorations/Tree3.png", {
            frameWidth: 1536 / 8,
            frameHeight: 192,
        });

        this.load.audio("jump_sfx", "sounds/jump.wav");
        this.load.audio("pickup_sfx", "sounds/pickup.wav");
        this.load.audio("step_sfx", "sounds/step.wav");
        this.load.audio("slide_sfx", "sounds/slide.wav");
        this.load.audio("fall_sfx", "sounds/fall.wav");
        this.load.audio("coin_sfx", "sounds/coin.wav");

        this.load.audio("theme_music", "music/theme.mp3");

        // crab
        for (let i = 1; i <= 9; i++) {
            this.load.image(`crab_idle_${i}`, `crab/01-Idle/Idle 0${i}.png`);
        }

        for (let i = 1; i <= 6; i++) {
            this.load.image(`crab_run_${i}`, `crab/02-Run/Run 0${i}.png`);
        }
    }

    create() {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        //  Move to the MainMenu. You could also swap this for a Scene Transition, such as a camera fade.
        this.scene.start("Game");
    }
}

