import Phaser, { Scene } from "phaser";
import { GameInputContextData } from "../../context/game";

/**
 * Interface para definir as configurações de cada fase.
 */
export interface LevelConfig {
    mapId: string;
    tileSetTerrain: string;
    tileSetBackground: string;
    bgMusicKey: string;
    blueTileKey?: string;
    parallaxLayers?: { name: string; speed: number }[];
}

export abstract class BaseScene extends Scene {
    // Referências do Player
    protected player: Phaser.Physics.Arcade.Sprite;
    protected cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    protected keys: any;

    // Camadas e Mapa
    protected map: Phaser.Tilemaps.Tilemap;
    protected worldLayer: Phaser.Tilemaps.TilemapLayer;
    protected backgroundLayers: Phaser.Tilemaps.TilemapLayer[] = [];

    // Fundo Infinito
    protected skyBackground: Phaser.GameObjects.TileSprite;

    // Estado do Personagem
    protected wasInAir: boolean = false;
    protected canDoubleJump: boolean = false;
    protected stepTimer: number = 0;
    protected wallSlideTimer: number = 0;
    protected dustTimer: number = 0;
    
    // Controle de Limites da Ilha
    private lastValidPosition: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0);

    // Efeitos, Itens e Mobs
    protected dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    protected collectiblesGroup: Phaser.Physics.Arcade.Group;
    protected mobsGroup: Phaser.Physics.Arcade.Group;
    protected finishPoint: Phaser.Physics.Arcade.Sprite;

    // Áudio
    protected sounds: { [key: string]: Phaser.Sound.BaseSound } = {};
    protected bgMusic: Phaser.Sound.BaseSound;

    // Contexto Mobile
    protected mobileControlsRef: GameInputContextData["controlsRef"];

    constructor(key: string) {
        super(key);
    }

    abstract getLevelConfig(): LevelConfig;

    create() {
        // 1. Criar o mapa usando a chave definida no Preloader ('mapa_fase1')
        const map = this.make.tilemap({ key: "mapa_fase1" });

        // --- DEBUG RÁPIDO PARA DESCOBRIR OS NOMES ---
        console.log("NOME DO TILESET:", map.tilesets[0].name);
        console.log(
            "NOMES DAS LAYERS:",
            map.layers.map((l) => l.name),
        );

        const config = this.getLevelConfig();
        this.mobileControlsRef = this.registry.get("controlsRef");

        // CORREÇÃO: Arredondar pixels evita tremor visual da câmera seguindo o player
        this.cameras.main.roundPixels = true;

        this.createGlobalAnimations();
        this.setupMap(config);
        this.setupControls();
        this.setupPlayerAndFinish();

        // Setup de grupos antes da física
        this.mobsGroup = this.physics.add.group({
            collideWorldBounds: true,
            bounceX: 0,
            bounceY: 0,
        });

        this.collectiblesGroup = this.physics.add.group({
            allowGravity: false,
        });

        this.createMobs(this.map);
        this.createCollectibles(this.map);

        this.setupPhysics();
        this.setupAudio(config);
        this.setupParticles();
        this.setupCamera();

        // GARANTIR gravidade zero no início (Top-Down)
        this.physics.world.gravity.y = 0;
        
        // Inicializa a última posição válida com a posição de spawn
        if (this.player) {
            this.lastValidPosition.set(this.player.x, this.player.y);
        }

        this.afterCreate();
    }

    private setupMap(config: LevelConfig) {
        this.map = this.make.tilemap({ key: config.mapId });

        const tileset = this.map.addTilesetImage(
            "Tilemap_color1",
            config.tileSetTerrain,
        );
        const bgKey = config.blueTileKey || config.tileSetBackground;
        const tilesetBlue = this.map.addTilesetImage("Blue back", bgKey);

        const width = this.scale.width;
        const height = this.scale.height;

        this.skyBackground = this.add.tileSprite(0, 0, width, height, bgKey);
        this.skyBackground.setOrigin(0, 0);
        this.skyBackground.setScrollFactor(0);
        this.skyBackground.setDepth(-100);

        if (config.parallaxLayers) {
            config.parallaxLayers.forEach((layerData, index) => {
                const layer = this.map.createLayer(
                    layerData.name,
                    tilesetBlue!,
                    0,
                    0,
                );
                if (layer) {
                    layer.setDepth(-50 + index);
                    layer.setScrollFactor(layerData.speed);
                    this.backgroundLayers.push(layer);
                }
            });
        }

        this.worldLayer = this.map.createLayer("world", tileset!, 0, 0)!;
        this.worldLayer.setCollisionByProperty({ collides: true });
        this.worldLayer.setDepth(0);
        
        // Configura gravidade zero especificamente para este mundo
        this.physics.world.gravity.y = 0;
        
        this.worldLayer.forEachTile((tile) => {
            if (tile.properties.through) {
                tile.setCollision(false, false, true, false);
            }
        });
    }

    protected setupPhysics() {
        if (this.player && this.worldLayer) {
            this.physics.add.collider(this.player, this.worldLayer);
        }

        if (this.finishPoint && this.worldLayer) {
            this.physics.add.collider(this.finishPoint, this.worldLayer);
        }

        if (this.mobsGroup && this.worldLayer) {
            this.physics.add.collider(this.mobsGroup, this.worldLayer);

            this.physics.add.overlap(this.player, this.mobsGroup, () => {
                this.onPlayerDeath();
            });
        }
    }

    private setupPlayerAndFinish() {
        const playerLayer = this.map.getObjectLayer("player");
        // Tenta achar Spawn Point, senão usa coordenadas padrão
        const spawnPoint = playerLayer?.objects.find(
            (obj) => obj.name === "PlayerSpawn",
        );
        const finishData = playerLayer?.objects.find(
            (obj) => obj.name === "Finish",
        );

        this.player = this.physics.add.sprite(
            spawnPoint?.x || 100,
            spawnPoint?.y || 300,
            "player_idle",
        );

        // --- AJUSTE DE HITBOX (CORPO FÍSICO) ---
        // Ajustamos para ficar bem focado na parte inferior do sprite
        this.player.body?.setSize(20, 24); 
        this.player.body?.setOffset(6, 21); // Desce a hitbox para cobrir só as pernas/pés
        
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(2);

        if (finishData) {
            this.finishPoint = this.physics.add.sprite(
                finishData.x!,
                finishData.y!,
                "finish",
            );
            this.finishPoint.setScale(0.5);
            this.finishPoint.setOrigin(0.5, 1);
            this.finishPoint.setDepth(1);
            this.finishPoint.setVisible(false);

            if (this.finishPoint.body) {
                const body = this.finishPoint
                    .body as Phaser.Physics.Arcade.Body;
                body.enable = false;
                body.setSize(44, 46);
                body.setOffset(10, 18);
                body.setImmovable(true);
                this.finishPoint.setCollideWorldBounds(true);
            }

            this.physics.add.overlap(this.player, this.finishPoint, () => {
                this.onLevelComplete();
            });
        }
    }
    private createMobs(map: Phaser.Tilemaps.Tilemap) {
        const enemyLayer = map.getObjectLayer("enemies");

        enemyLayer?.objects.forEach((obj) => {
            const initialTexture = this.textures.exists("crab_idle_1")
                ? "crab_idle_1"
                : "player_idle";

            const mob = this.mobsGroup.create(
                obj.x,
                obj.y,
                initialTexture,
            ) as Phaser.Physics.Arcade.Sprite;

            mob.setOrigin(0.5, 1);

            const bodyWidth = 30;
            const bodyHeight = 22;

            if (mob.body) {
                const body = mob.body as Phaser.Physics.Arcade.Body;
                body.setSize(bodyWidth, bodyHeight);
                const offsetX = (mob.width - bodyWidth) / 2;
                const offsetY = mob.height - bodyHeight - 8;
                body.setOffset(offsetX, offsetY);
                // Mobs também não devem cair no Top-Down, a menos que seja intencional
                body.setGravityY(0); 
            }

            mob.setData("state", "run");
            mob.setData("direction", -1);
            mob.setVelocityX(-60);

            if (this.anims.exists("crab_run")) {
                mob.play("crab_run");
            }
        });
    }

    update() {
        if (!this.player || !this.player.body) return;

        this.handleMovement();
        this.handleAnimations();
        this.handleGroundEffects();
        this.handleMobsAI();
        this.checkMapBounds(); // Adicionada verificação de limites da ilha

        if (this.skyBackground) {
            this.skyBackground.tilePositionX = this.cameras.main.scrollX * 0.1;
            this.skyBackground.tilePositionY = this.cameras.main.scrollY * 0.1;
        }

        if (this.finishPoint && this.finishPoint.body) {
            const finishBody = this.finishPoint
                .body as Phaser.Physics.Arcade.Body;
            if (finishBody.blocked.down) {
                finishBody.setAllowGravity(false);
                finishBody.setVelocity(0, 0);
            }
        }
    }

    /**
     * Garante que o jogador fique apenas nos tiles desenhados (grama)
     * e não ande no "vazio" (fundo azul).
     */
    private checkMapBounds() {
        if (!this.player || !this.worldLayer || !this.player.body) return;

        // Por padrão, verifica o centro
        let checkX = this.player.body.center.x;

        // AJUSTE LATERAL:
        // Verifica a borda para onde o jogador está indo.
        // REMOVIDO os offsets (+4/-4) para garantir que a hitbox não saia nem 1 pixel.
        if (this.player.body.velocity.x < 0) {
            // Indo para a ESQUERDA: Verifica o limite esquerdo exato da hitbox
            checkX = this.player.body.x - 10;
        } else if (this.player.body.velocity.x > 0) {
            // Indo para a DIREITA: Verifica o limite direito exato da hitbox
            checkX = this.player.body.right + 10;
        }
        
        // CONFIGURAÇÃO DO LIMITE VERTICAL (Topo/Baixo)
        let checkY = this.player.body.bottom - 2;

        // DETECÇÃO DE TOPO
        // Se estiver subindo, verifica o centro vertical (cintura) para dar profundidade
        if (this.player.body.velocity.y < 0) {
            checkY = this.player.body.center.y - 10; 
        } else if (this.player.body.velocity.y > 0) {
            // Descendo, verifica a borda inferior da hitbox
            checkY = this.player.body.bottom + 10;
        }

        // Verifica se tem tile na camada 'world' nesta coordenada
        // O terceiro parametro 'true' filtra tiles vazios (index -1)
        const tile = this.worldLayer.getTileAtWorldXY(checkX, checkY, true);

        // ATENÇÃO: Se você pintou "água" na camada 'world', o tile vai existir e o boneco vai andar.
        // A camada 'world' deve ter APENAS a grama/chão.
        if (tile && tile.index !== -1) {
            // Se tem tile (grama), atualiza a última posição válida
            this.lastValidPosition.set(this.player.x, this.player.y);
        } else {
            // Se não tem tile (é buraco/água), TELEPORTA de volta e PARA O MOVIMENTO
            this.player.setPosition(this.lastValidPosition.x, this.lastValidPosition.y);
            this.player.setVelocity(0, 0); 
        }
    }

    protected handleMobsAI() {
        // Simplificado para evitar erros no Top-Down
        // Se precisar de IA complexa, precisaria adaptar para andar em Y também
        this.mobsGroup.children.entries.forEach((m) => {
            const mob = m as Phaser.Physics.Arcade.Sprite;
            // Apenas garante que os mobs renderizem corretamente por enquanto
            mob.setDepth(1);
        });
    }

    protected onPlayerDeath() {
        console.log("Player morreu!");
        this.sounds.fall?.play();
        this.cameras.main.shake(200, 0.01);

        this.player.setTint(0xff0000);
        this.physics.pause();

        this.time.delayedCall(500, () => {
            this.scene.restart();
        });
    }

    protected onLevelComplete() {
        console.log("Fase concluída!");
        this.player.setVelocity(0);
        if (this.player.body) {
            this.player.body.enable = false;
        }
    }

    protected afterCreate() {}

    private setupControls() {
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.keys = {
            w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            enter: this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.ENTER,
            ),
            space: this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.SPACE,
            ),
        };
    }

    private setupAudio(config: LevelConfig) {
        this.sounds.jump = this.sound.add("jump_sfx", { volume: 0.5 });
        this.sounds.fall = this.sound.add("fall_sfx", { volume: 0.5 });
        this.sounds.collect = this.sound.add("pickup_sfx", { volume: 0.4 });
        this.sounds.step = this.sound.add("step_sfx", { volume: 0.3 });
        this.sounds.slide = this.sound.add("slide_sfx", { volume: 0.2 });

        this.bgMusic = this.sound.add(config.bgMusicKey, {
            volume: 0.1,
            loop: true,
        });
        if (!this.sound.locked) this.bgMusic.play();
        else
            this.sound.once(Phaser.Sound.Events.UNLOCKED, () =>
                this.bgMusic.play(),
            );
    }

    private setupParticles() {
        this.dustEmitter = this.add.particles(0, 0, "dust", {
            lifespan: 300,
            scale: { start: 0.6, end: 0 },
            alpha: { start: 0.6, end: 0 },
            speedY: { min: -20, max: -5 },
            speedX: { min: -5, max: 5 },
            frequency: -1,
        });
        this.dustEmitter.startFollow(this.player);
        this.dustEmitter.setDepth(1);
    }

    private setupCamera() {
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setBounds(
            0,
            0,
            this.map.widthInPixels,
            this.map.heightInPixels,
        );
        const zoom = Math.max(
            window.innerWidth / this.map.widthInPixels,
            window.innerHeight / this.map.heightInPixels,
        );
        // this.cameras.main.setZoom(zoom);
    }

    // --- NOVA MOVIMENTAÇÃO TOP-DOWN ---
    protected handleMovement() {
        const speed = 160;
        // Importante: No Top-Down, zeramos a velocidade a cada frame para evitar deslizar
        this.player.setVelocity(0);

        const keys = this.keys;
        const cursors = this.cursors;
        const mobile = this.mobileControlsRef.current;

        // Movimento Vertical (Cima/Baixo)
        // Adicionamos 'keys.w' e 'cursors.up' para mover em Y
        if (keys.w.isDown || cursors.up.isDown || mobile.jump) {
            this.player.setVelocityY(-speed);
        } else if (keys.s.isDown || cursors.down.isDown) {
            this.player.setVelocityY(speed);
        }

        // Movimento Horizontal (Esquerda/Direita)
        if (keys.a.isDown || cursors.left.isDown || mobile.left) {
            this.player.setVelocityX(-speed);
            this.player.setFlipX(true);
        } else if (keys.d.isDown || cursors.right.isDown || mobile.right) {
            this.player.setVelocityX(speed);
            this.player.setFlipX(false);
        }

        // Opcional: Normalizar para não andar mais rápido na diagonal
        // if (this.player.body.velocity.x !== 0 && this.player.body.velocity.y !== 0) {
        //    this.player.body.velocity.normalize().scale(speed);
        // }
    }

    private performJump() {
        // Removido/Desativado para Top-Down
    }

    // --- NOVA ANIMAÇÃO TOP-DOWN ---
    protected handleAnimations() {
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        
        // Simplesmente verifica se tem velocidade em qualquer eixo
        const isMoving = playerBody.velocity.x !== 0 || playerBody.velocity.y !== 0;

        if (isMoving) {
            this.player.anims.play("run", true);
        } else {
            this.player.anims.play("idle", true);
        }
    }

    protected handleGroundEffects() {
        // Efeito simples de poeira ao andar
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        const isMoving = playerBody.velocity.x !== 0 || playerBody.velocity.y !== 0;

        if (isMoving) {
            this.stepTimer++;
            if (this.stepTimer >= 20) {
                this.sounds.step.play({
                    volume: 0.3,
                    detune: Phaser.Math.Between(-100, 100),
                });
                this.stepTimer = 0;
            }
        }
    }

    protected explodeDust(count: number) {
        this.dustEmitter.followOffset.set(0, 12);
        this.dustEmitter.explode(count);
    }

    private createGlobalAnimations() {
        if (this.anims.exists("idle")) return;

        // Animação Idle (Individual PNGs)
        const crabIdleFrames = [];
        for (let i = 1; i <= 9; i++) {
            const key = `crab_idle_${i}`;
            if (this.textures.exists(key)) crabIdleFrames.push({ key });
        }
        if (crabIdleFrames.length > 0)
            this.anims.create({
                key: "crab_idle",
                frames: crabIdleFrames,
                frameRate: 10,
                repeat: -1,
            });

        // Animação Run (Individual PNGs) - ADICIONADO AGORA
        const crabRunFrames = [];
        for (let i = 1; i <= 6; i++) {
            const key = `crab_run_${i}`;
            if (this.textures.exists(key)) crabRunFrames.push({ key });
        }
        if (crabRunFrames.length > 0)
            this.anims.create({
                key: "crab_run",
                frames: crabRunFrames,
                frameRate: 12,
                repeat: -1,
            });

        this.anims.create({
            key: "strawberry_idle",
            frames: this.anims.generateFrameNumbers("strawberry", {
                start: 0,
                end: 16,
            }),
            frameRate: 20,
            repeat: -1,
        });
        this.anims.create({
            key: "finish_idle",
            frames: this.anims.generateFrameNumbers("finish", {
                start: 0,
                end: 7,
            }),
            frameRate: 15,
            repeat: -1,
        });
        this.anims.create({
            key: "idle",
            frames: this.anims.generateFrameNumbers("player_idle", {
                start: 0,
                end: 6,
            }),
            frameRate: 20,
            repeat: -1,
        });
        this.anims.create({
            key: "run",
            frames: this.anims.generateFrameNumbers("player_run", {
                start: 0,
                end: 6,
            }),
            frameRate: 20,
            repeat: -1,
        });
        this.anims.create({
            key: "jump",
            frames: [{ key: "player_jump", frame: 0 }],
            frameRate: 20,
        });
        this.anims.create({
            key: "fall",
            frames: [{ key: "player_fall", frame: 0 }],
            frameRate: 20,
        });
        this.anims.create({
            key: "wall_jump",
            frames: [{ key: "player_wall_jump", frame: 0 }],
            frameRate: 20,
        });
        this.anims.create({
            key: "double_jump",
            frames: this.anims.generateFrameNumbers("player_double_jump", {
                start: 0,
                end: 5,
            }),
            frameRate: 20,
            repeat: 0,
        });
        this.anims.create({
            key: "collected",
            frames: this.anims.generateFrameNumbers("collected", {
                start: 0,
                end: 6,
            }),
            frameRate: 20,
            repeat: 0,
        });
    }

    private createCollectibles(map: Phaser.Tilemaps.Tilemap) {
        const fruitPoints = map.filterObjects(
            "collectibles",
            (obj) => obj.name !== "Strawberry",
        );
        fruitPoints?.forEach((point) => {
            const f = this.collectiblesGroup.create(
                point.x,
                point.y,
                "strawberry",
            );
            f.play("strawberry_idle");
            f.body?.setSize(14, 14);
            f.body?.setOffset(9, 9);
        });
        if (this.collectiblesGroup.countActive(true) === 0)
            this.activateFinish();
        this.physics.add.overlap(
            this.player,
            this.collectiblesGroup,
            (_p, f) => {
                const fruit = f as Phaser.Physics.Arcade.Sprite;
                if (fruit.body) fruit.body.enable = false;
                this.sounds.collect.play();
                fruit.play("collected");
                fruit.on("animationcomplete", () => {
                    fruit.destroy();
                    if (this.collectiblesGroup.countActive(true) === 0)
                        this.activateFinish();
                });
            },
        );
    }

    private activateFinish() {
        if (this.finishPoint && this.finishPoint.body) {
            this.finishPoint.setVisible(true);
            this.finishPoint.body.enable = true;
            this.finishPoint.setAlpha(0);
            this.tweens.add({
                targets: this.finishPoint,
                alpha: 1,
                duration: 500,
                ease: "Power2",
            });
            this.finishPoint.play("finish_idle");
        }
    }
}