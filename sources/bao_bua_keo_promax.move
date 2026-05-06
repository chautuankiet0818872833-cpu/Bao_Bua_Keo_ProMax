module bao_bua_keo_promax::bao_bua_keo_promax {
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::coin::{Self, Coin};
    use sui::hash;
    use sui::clock::Clock;

    /// Error codes
    const EInvalidState: u64 = 0;
    const EStakeMismatch: u64 = 1;
    const EAlreadyJoined: u64 = 2;
    const ENotPlayer1: u64 = 3;
    const EInvalidCommitment: u64 = 4;
    const EInvalidChoice: u64 = 5;
    const ETimeoutNotReached: u64 = 6;

    /// Constants
    const TIMEOUT_MS: u64 = 120_000; // 2 minutes

    /// Choices: 0 = Rock, 1 = Paper, 2 = Scissors
    const ROCK: u8 = 0;
    const PAPER: u8 = 1;
    const SCISSORS: u8 = 2;

    /// Trạng thái của trò chơi
    public enum GameState has copy, drop, store {
        Waiting,
        Reveal,
        Finished
    }

    /// Cấu trúc chính của trò chơi (Shared Object)
    public struct Game has key {
        id: UID,
        balance: Balance<SUI>,
        player1: address,
        player2: address,
        commitment: vector<u8>,
        player2_choice: u8,
        state: GameState,
        timestamp: u64,
    }

    /// Tạo một game mới
    public fun create_game(
        coin: Coin<SUI>,
        commitment: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let balance = coin.into_balance();
        let game = Game {
            id: object::new(ctx),
            balance,
            player1: ctx.sender(),
            player2: @0x0,
            commitment,
            player2_choice: 0,
            state: GameState::Waiting,
            timestamp: clock.timestamp_ms(),
        };
        transfer::share_object(game);
    }

    /// Tham gia một game hiện có
    public fun join_game(
        game: &mut Game,
        coin: Coin<SUI>,
        player2_choice: u8,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(player2_choice <= 2, EInvalidChoice);
        assert!(game.state == GameState::Waiting, EInvalidState);
        assert!(game.player2 == @0x0, EAlreadyJoined);

        // Kiểm tra tiền cược phải bằng nhau
        let stake_amount = coin.value();
        assert!(stake_amount == balance::value(&game.balance), EStakeMismatch);

        // Nạp tiền cược vào game
        balance::join(&mut game.balance, coin.into_balance());
        
        // Cập nhật thông tin game
        game.player2 = ctx.sender();
        game.player2_choice = player2_choice;
        game.state = GameState::Reveal;
        game.timestamp = clock.timestamp_ms();
    }

    /// Tiết lộ lựa chọn và kết thúc game
    public fun reveal_result(
        game: &mut Game,
        choice1: u8,
        salt: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(choice1 <= 2, EInvalidChoice);
        assert!(game.state == GameState::Reveal, EInvalidState);
        assert!(ctx.sender() == game.player1, ENotPlayer1);

        // Kiểm tra bản băm commitment (choice1 + salt)
        let mut data = salt;
        data.push_back(choice1);
        let hashed = hash::blake2b256(&data);
        assert!(hashed == game.commitment, EInvalidCommitment);

        let choice2 = game.player2_choice;
        let total_prize = balance::value(&game.balance);
        
        if (choice1 == choice2) {
            // Hòa: Chia đôi tiền
            let half = total_prize / 2;
            let p1_share = balance::split(&mut game.balance, half);
            let p2_share = balance::withdraw_all(&mut game.balance);
            
            transfer::public_transfer(coin::from_balance(p1_share, ctx), game.player1);
            transfer::public_transfer(coin::from_balance(p2_share, ctx), game.player2);
        } else if (
            (choice1 == ROCK && choice2 == SCISSORS) ||
            (choice1 == PAPER && choice2 == ROCK) ||
            (choice1 == SCISSORS && choice2 == PAPER)
        ) {
            // Player 1 thắng: Lấy hết
            let prize = balance::withdraw_all(&mut game.balance);
            transfer::public_transfer(coin::from_balance(prize, ctx), game.player1);
        } else {
            // Player 2 thắng: Lấy hết
            let prize = balance::withdraw_all(&mut game.balance);
            transfer::public_transfer(coin::from_balance(prize, ctx), game.player2);
        };

        game.state = GameState::Finished;
    }

    /// Rút lại tiền nếu chưa có người chơi thứ 2 tham gia
    public fun cancel_game(
        game: &mut Game,
        ctx: &mut TxContext
    ) {
        assert!(game.state == GameState::Waiting, EInvalidState);
        assert!(ctx.sender() == game.player1, ENotPlayer1);
        
        let prize = balance::withdraw_all(&mut game.balance);
        transfer::public_transfer(coin::from_balance(prize, ctx), game.player1);
        
        game.state = GameState::Finished;
    }

    /// Người chơi thứ 2 thắng nếu người chơi thứ 1 không chịu reveal (sau 2 phút)
    public fun claim_timeout(
        game: &mut Game,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(game.state == GameState::Reveal, EInvalidState);
        // Kiểm tra timeout (2 phút)
        assert!(clock.timestamp_ms() > game.timestamp + TIMEOUT_MS, ETimeoutNotReached);
        
        let prize = balance::withdraw_all(&mut game.balance);
        transfer::public_transfer(coin::from_balance(prize, ctx), game.player2);
        
        game.state = GameState::Finished;
    }
}

