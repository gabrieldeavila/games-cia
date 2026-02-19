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

    // Controle da Animação da Água e Espuma
    private waterTime: number = 0;
    protected foamGroup: Phaser.GameObjects.Group;

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
        const map = this.make.tilemap({ key: "mapa_fase1" });

        const config = this.getLevelConfig();
        this.mobileControlsRef = this.registry.get("controlsRef");

        this.cameras.main.roundPixels = true;

        this.createGlobalAnimations();
        this.setupMap(config);
        
        // --- NOVO: GERAR ESPUMA AUTOMATICAMENTE ---
        this.createFoamAnimation();
        this.generateFoamBorder();
        // ------------------------------------------

        this.setupControls();
        this.setupPlayerAndFinish();

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

        this.physics.world.gravity.y = 0;
        
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
        
        this.physics.world.gravity.y = 0;
        
        this.worldLayer.forEachTile((tile) => {
            if (tile.properties.through) {
                tile.setCollision(false, false, true, false);
            }
        });
    }

    // --- LÓGICA DA ESPUMA ---

    private createFoamAnimation() {
        // Verifica se a textura foi carregada
        if (!this.textures.exists("water_foam")) {
            console.warn("Aviso: Textura 'water_foam' não encontrada! Verifique se descomentou no Preloader.");
            return;
        }

        // Remove animação anterior se existir para recriar corretamente
        if (this.anims.exists("foam_anim")) {
            this.anims.remove("foam_anim");
        }

        // Debug para ver se a imagem carregou com tamanho certo
        const texture = this.textures.get("water_foam");
        const source = texture.getSourceImage();
        console.log(`[Foam Debug] Textura carregada. Tamanho Real: ${source.width}x${source.height}`);
        console.log(`[Foam Debug] Frames detectados pelo Phaser: ${texture.frameTotal}`);

        // Cria a animação usando TODOS os frames disponíveis automaticamente
        // Isso evita erro de tentar tocar frame 7 se só existem 3 frames
        this.anims.create({
            key: "foam_anim",
            frames: this.anims.generateFrameNumbers("water_foam", {}), 
            frameRate: 8,
            repeat: -1
        });
    }

    private generateFoamBorder() {
        if (!this.worldLayer) return;

        this.foamGroup = this.add.group();
        let foamCount = 0;
        const tileWidth = this.map.tileWidth;
        const tileHeight = this.map.tileHeight;

        this.worldLayer.forEachTile((tile) => {
            // Verifica se o tile atual é ÁGUA (vazio / index -1)
            if (tile.index === -1) {
                
                // Checa vizinhos para ver se tem terra por perto
                const up = this.worldLayer.getTileAt(tile.x, tile.y - 1);
                const down = this.worldLayer.getTileAt(tile.x, tile.y + 1);
                const left = this.worldLayer.getTileAt(tile.x - 1, tile.y);
                const right = this.worldLayer.getTileAt(tile.x + 1, tile.y);

                const hasLandUp = up && up.index !== -1;
                const hasLandDown = down && down.index !== -1;
                const hasLandLeft = left && left.index !== -1;
                const hasLandRight = right && right.index !== -1;

                if (hasLandUp || hasLandDown || hasLandLeft || hasLandRight) {
                    const posX = (tile.x * tileWidth) + (tileWidth / 2);
                    const posY = (tile.y * tileHeight) + (tileHeight / 2);

                    const foam = this.add.sprite(posX, posY, "water_foam");
                    
                    // --- AJUSTE DE ESCALA (CORRIGIDO) ---
                    // Aumentamos o multiplicador para 3.0x o tamanho do tile.
                    // Se o tile é 32px, a espuma ficará com ~96px visuais.
                    // Como a imagem original é 192px e provavelmente tem transparência em volta,
                    // isso garante que a parte visível da espuma se conecte sem buracos.
                    const targetSize = tileWidth * 3.0; 
                    
                    // Calculamos a escala necessária para atingir o targetSize
                    const scale = targetSize / foam.width;
                    foam.setScale(scale);

                    // --- AJUSTE DE POSIÇÃO E ROTAÇÃO ---
                    // Empurra a espuma para DENTRO do tile de terra (overlap).
                    // Como vamos colocar depth -1, a parte que sobrepõe a terra ficará escondida.
                    // Aumentado de 0.4 para 0.7 para ficar "mais pra dentro"
                    const overlap = tileWidth * 1.05; 

                    if (hasLandRight) {
                        foam.setAngle(90);
                        foam.x += overlap;
                    }
                    else if (hasLandDown) {
                        foam.setAngle(180);
                        foam.y += overlap;
                    }
                    else if (hasLandLeft) {
                        foam.setAngle(-90);
                        foam.x -= overlap;
                    } 
                    else if (hasLandUp) {
                        // Padrão (ângulo 0)
                        foam.y -= overlap;
                    }

                    // Define profundidade -1 para ficar ABAIXO da camada worldLayer (que é 0)
                    foam.setDepth(-1); 
                    
                    if (this.anims.exists("foam_anim")) {
                        foam.play("foam_anim");
                        foam.anims.setProgress(Math.random());
                    } else {
                        console.warn("Animação foam_anim falhou, mostrando estático");
                    }
                    
                    this.foamGroup.add(foam);
                    foamCount++;
                }
            }
        });

        console.log(`[Foam Debug] Espumas geradas na borda: ${foamCount}`);
    }

    // -------------------------

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

        this.player.body?.setSize(20, 24); 
        this.player.body?.setOffset(6, 21);
        
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
        this.checkMapBounds();
        this.handleWaterAnimation(); 

        if (this.finishPoint && this.finishPoint.body) {
            const finishBody = this.finishPoint
                .body as Phaser.Physics.Arcade.Body;
            if (finishBody.blocked.down) {
                finishBody.setAllowGravity(false);
                finishBody.setVelocity(0, 0);
            }
        }
    }

    private handleWaterAnimation() {
        if (this.skyBackground) {
            this.waterTime += 0.02;
            const cameraX = this.cameras.main.scrollX * 0.1;
            const cameraY = this.cameras.main.scrollY * 0.1;
            const flowX = this.waterTime * 10;
            const flowY = this.waterTime * 5;
            const waveX = Math.sin(this.waterTime) * 5;

            this.skyBackground.tilePositionX = cameraX + flowX + waveX;
            this.skyBackground.tilePositionY = cameraY + flowY;
        }
    }

    private checkMapBounds() {
        if (!this.player || !this.worldLayer || !this.player.body) return;

        let checkX = this.player.body.center.x;

        if (this.player.body.velocity.x < 0) {
            checkX = this.player.body.x - 10;
        } else if (this.player.body.velocity.x > 0) {
            checkX = this.player.body.right + 10;
        }
        
        let checkY = this.player.body.bottom - 2;

        if (this.player.body.velocity.y < 0) {
            checkY = this.player.body.center.y - 10; 
        } else if (this.player.body.velocity.y > 0) {
            checkY = this.player.body.bottom + 10;
        }

        const tile = this.worldLayer.getTileAtWorldXY(checkX, checkY, true);

        if (tile && tile.index !== -1) {
            this.lastValidPosition.set(this.player.x, this.player.y);
        } else {
            this.player.setPosition(this.lastValidPosition.x, this.lastValidPosition.y);
            this.player.setVelocity(0, 0); 
        }
    }

    protected handleMobsAI() {
        this.mobsGroup.children.entries.forEach((m) => {
            const mob = m as Phaser.Physics.Arcade.Sprite;
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
        this.cameras.main.setZoom(zoom);
    }

    protected handleMovement() {
        const speed = 160;
        this.player.setVelocity(0);

        const keys = this.keys;
        const cursors = this.cursors;
        const mobile = this.mobileControlsRef.current;

        if (keys.w.isDown || cursors.up.isDown || mobile.jump) {
            this.player.setVelocityY(-speed);
        } else if (keys.s.isDown || cursors.down.isDown) {
            this.player.setVelocityY(speed);
        }

        if (keys.a.isDown || cursors.left.isDown || mobile.left) {
            this.player.setVelocityX(-speed);
            this.player.setFlipX(true);
        } else if (keys.d.isDown || cursors.right.isDown || mobile.right) {
            this.player.setVelocityX(speed);
            this.player.setFlipX(false);
        }
    }

    private performJump() {}

    protected handleAnimations() {
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        const isMoving = playerBody.velocity.x !== 0 || playerBody.velocity.y !== 0;

        if (isMoving) {
            this.player.anims.play("run", true);
        } else {
            this.player.anims.play("idle", true);
        }
    }

    protected handleGroundEffects() {
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