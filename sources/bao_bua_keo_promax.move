module bao_bua_keo_promax::bao_bua_keo_promax {
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::coin::{Self, Coin};
    use sui::hash;
    use sui::clock::Clock;
    use sui::event;

    /// ==================== Error Codes ====================
    const EInvalidState: u64 = 0;
    const EInvalidWagerAmount: u64 = 1;
    const EAlreadyJoined: u64 = 2;
    const ENotPlayer1: u64 = 3;
    const ENotPlayer2: u64 = 4;
    const EInvalidCommitment: u64 = 5;
    const EInvalidChoice: u64 = 6;
    const ETimeoutNotReached: u64 = 7;
    const EEmptyWager: u64 = 8;
    const EInvalidSalt: u64 = 9;
    const EGameAlreadyFinished: u64 = 10;

    /// ==================== Constants ====================
    /// Choices: 0 = Rock, 1 = Paper, 2 = Scissors
    const CHOICE_ROCK: u8 = 0;
    const CHOICE_PAPER: u8 = 1;
    const CHOICE_SCISSORS: u8 = 2;

    const RESULT_DRAW: u8 = 0;
    const RESULT_PLAYER1_WIN: u8 = 1;
    const RESULT_PLAYER2_WIN: u8 = 2;

    const MIN_WAGER: u64 = 1_000_000; // 0.001 SUI
    const MAX_SALT_LENGTH: u64 = 1024; // Prevent DOS with huge salt

    /// ==================== Game State ====================
    public enum GameState has copy, drop, store {
        Waiting,
        Reveal,
        Finished
    }

    public struct Game has key {
        id: sui::object::UID,
        wager: Balance<SUI>,
        player1: address,
        player2: address,
        commitment: vector<u8>,
        player2_choice: u8,
        state: GameState,
        timeout_at_ms: u64,
    }

    /// ==================== Events ====================
    public struct GameCreated has copy, drop {
        game_id: sui::object::ID,
        player1: address,
        player2: address,
        wager_amount: u64,
    }

    public struct GameJoined has copy, drop {
        game_id: sui::object::ID,
        player2: address,
        timestamp_ms: u64,
    }

    public struct GameSettled has copy, drop {
        game_id: sui::object::ID,
        winner: address,
        p1_choice: u8,
        p2_choice: u8,
        result: u8,
    }

    public struct GameTimedOut has copy, drop {
        game_id: sui::object::ID,
        claimer: address,
        is_waiting_stage: bool,
    }

    /// ==================== Public Functions ====================
    
    /// Tạo game mới với commitment từ player 1
    public fun create_game(
        wager_coin: Coin<SUI>,
        player2: address,
        commitment: vector<u8>,
        join_timeout_ms: u64,
        clock: &Clock,
        ctx: &mut sui::tx_context::TxContext,
    ) {
        let wager_amount = sui::coin::value(&wager_coin);
        
        // Validate inputs
        assert!(wager_amount >= MIN_WAGER, EEmptyWager);
        assert!(commitment.length() == 32, EInvalidCommitment); // blake2b256 output is 32 bytes
        assert!(join_timeout_ms > 0, EInvalidState);

        let game_id = sui::object::new(ctx);
        let id_copy = sui::object::uid_to_inner(&game_id);

        let game = Game {
            id: game_id,
            wager: sui::coin::into_balance(wager_coin),
            player1: sui::tx_context::sender(ctx),
            player2,
            commitment,
            player2_choice: CHOICE_ROCK,
            state: GameState::Waiting,
            timeout_at_ms: sui::clock::timestamp_ms(clock) + join_timeout_ms,
        };

        event::emit(GameCreated {
            game_id: id_copy,
            player1: sui::tx_context::sender(ctx),
            player2,
            wager_amount,
        });

        sui::transfer::share_object(game);
    }

    /// Player 2 tham gia game với choice của họ
    public fun join_game(
        game: &mut Game,
        wager_coin: Coin<SUI>,
        player2_choice: u8,
        reveal_timeout_ms: u64,
        clock: &Clock,
        ctx: &mut sui::tx_context::TxContext,
    ) {
        // Validate state
        assert!(game.state == GameState::Waiting, EInvalidState);
        assert!(sui::clock::timestamp_ms(clock) < game.timeout_at_ms, ETimeoutNotReached);

        // Validate player2
        let sender = sui::tx_context::sender(ctx);
        if (game.player2 != @0x0) {
            assert!(sender == game.player2, EAlreadyJoined);
        } else {
            game.player2 = sender;
        };

        // Validate choice
        assert!(is_valid_choice(player2_choice), EInvalidChoice);

        // Validate wager
        let wager_amount = sui::coin::value(&wager_coin);
        assert!(
            wager_amount == sui::balance::value(&game.wager),
            EInvalidWagerAmount
        );

        // Update game state
        sui::balance::join(&mut game.wager, sui::coin::into_balance(wager_coin));
        game.player2_choice = player2_choice;
        game.state = GameState::Reveal;
        game.timeout_at_ms = sui::clock::timestamp_ms(clock) + reveal_timeout_ms;

        event::emit(GameJoined {
            game_id: sui::object::uid_to_inner(&game.id),
            player2: sender,
            timestamp_ms: sui::clock::timestamp_ms(clock),
        });
    }

    /// Player 1 reveal choice và settle game
    public fun reveal_and_settle(
        game: Game,
        player1_choice: u8,
        salt: vector<u8>,
        ctx: &mut sui::tx_context::TxContext,
    ) {
        let mut game = game;
        let sender = sui::tx_context::sender(ctx);

        // Validate state
        assert!(game.state == GameState::Reveal, EInvalidState);
        assert!(sender == game.player1, ENotPlayer1);

        // Validate inputs
        assert!(is_valid_choice(player1_choice), EInvalidChoice);
        assert!(salt.length() <= MAX_SALT_LENGTH, EInvalidSalt);
        assert!(
            game.commitment == compute_commitment(player1_choice, &salt),
            EInvalidCommitment
        );

        let player1 = game.player1;
        let player2 = game.player2;
        let player2_choice = game.player2_choice;
        let result = decide_winner(player1_choice, player2_choice);
        
        // Distribute wager
        let total_wager = sui::balance::value(&game.wager);
        let winner = if (result == RESULT_DRAW) {
            let half = total_wager / 2;
            pay_from_game(&mut game, player1, half, ctx);
            pay_all_from_game(&mut game, player2, ctx);
            @0x0
        } else if (result == RESULT_PLAYER1_WIN) {
            pay_all_from_game(&mut game, player1, ctx);
            player1
        } else {
            pay_all_from_game(&mut game, player2, ctx);
            player2
        };

        event::emit(GameSettled {
            game_id: sui::object::uid_to_inner(&game.id),
            winner,
            p1_choice: player1_choice,
            p2_choice: player2_choice,
            result,
        });

        // Cleanup
        let Game { id, wager, .. } = game;
        sui::balance::destroy_zero(wager);
        sui::object::delete(id);
    }

    /// Claim timeout compensation (player 1 waiting, player 2 reveal)
    public fun claim_timeout(
        game: Game,
        clock: &Clock,
        ctx: &mut sui::tx_context::TxContext,
    ) {
        let mut game = game;
        let sender = sui::tx_context::sender(ctx);
        let current_time = sui::clock::timestamp_ms(clock);

        // Validate timeout
        assert!(current_time >= game.timeout_at_ms, ETimeoutNotReached);
        assert!(game.state != GameState::Finished, EGameAlreadyFinished);

        let player1 = game.player1;
        let player2 = game.player2;
        let is_waiting_stage = game.state == GameState::Waiting;

        // Determine who can claim (whoever is waiting)
        let claimer = if (is_waiting_stage) {
            assert!(sender == player1, ENotPlayer1);
            pay_all_from_game(&mut game, player1, ctx);
            player1
        } else {
            assert!(sender == player2, ENotPlayer2);
            pay_all_from_game(&mut game, player2, ctx);
            player2
        };

        event::emit(GameTimedOut {
            game_id: sui::object::uid_to_inner(&game.id),
            claimer,
            is_waiting_stage,
        });

        let Game { id, wager, .. } = game;
        sui::balance::destroy_zero(wager);
        sui::object::delete(id);
    }

    /// ==================== Helper Functions ====================

    fun is_valid_choice(choice: u8): bool {
        choice == CHOICE_ROCK || choice == CHOICE_PAPER || choice == CHOICE_SCISSORS
    }

    fun compute_commitment(choice: u8, salt: &vector<u8>): vector<u8> {
        let mut bytes = vector[choice];
        let mut i = 0;
        while (i < salt.length()) {
            bytes.push_back(*salt.borrow(i));
            i = i + 1;
        };
        hash::blake2b256(&bytes)
    }

    fun decide_winner(player1_choice: u8, player2_choice: u8): u8 {
        if (player1_choice == player2_choice) {
            RESULT_DRAW
        } else if (
            (player1_choice == CHOICE_ROCK && player2_choice == CHOICE_SCISSORS) ||
            (player1_choice == CHOICE_PAPER && player2_choice == CHOICE_ROCK) ||
            (player1_choice == CHOICE_SCISSORS && player2_choice == CHOICE_PAPER)
        ) {
            RESULT_PLAYER1_WIN
        } else {
            RESULT_PLAYER2_WIN
        }
    }

    fun pay_from_game(
        game: &mut Game,
        recipient: address,
        amount: u64,
        ctx: &mut sui::tx_context::TxContext
    ) {
        let payout_balance = sui::balance::split(&mut game.wager, amount);
        let payout_coin = sui::coin::from_balance(payout_balance, ctx);
        sui::transfer::public_transfer(payout_coin, recipient);
    }

    fun pay_all_from_game(
        game: &mut Game,
        recipient: address,
        ctx: &mut sui::tx_context::TxContext
    ) {
        let amount = sui::balance::value(&game.wager);
        if (amount > 0) {
            pay_from_game(game, recipient, amount, ctx);
        };
    }
}

