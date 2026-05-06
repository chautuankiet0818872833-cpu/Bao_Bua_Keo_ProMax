module contractsb_b_k_prm::contractsb_b_k_prm;

use sui::balance::Balance;
use sui::clock::Clock;
use sui::coin::Coin;
use sui::sui::SUI;

public enum GameState has copy, drop, store {
    Waiting,
    Reveal,
    Finished,
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
    closed: bool,
}

// --- Events ---
public struct GameCreated has copy, drop {
    game_id: ID,
    player1: address,
    player2: address,
    wager_amount: u64,
}

public struct GameJoined has copy, drop {
    game_id: ID,
    player2: address,
}

public struct GameSettled has copy, drop {
    game_id: ID,
    winner: address,
    p1_choice: u8,
    p2_choice: u8,
    result: u8, // 0: Draw, 1: P1 Win, 2: P2 Win
}

public struct GameTimedOut has copy, drop {
    game_id: ID,
    claimer: address,
    is_waiting_stage: bool,
}

const EInvalidChoice: u64 = 1;
const EInvalidState: u64 = 2;
const EInvalidPlayer: u64 = 3;
const EInvalidCommitment: u64 = 4;
const ETimeoutNotReached: u64 = 5;
const EInvalidWagerAmount: u64 = 6;

const CHOICE_ROCK: u8 = 0;
const CHOICE_PAPER: u8 = 1;
const CHOICE_SCISSORS: u8 = 2;

const RESULT_DRAW: u8 = 0;
const RESULT_PLAYER1_WIN: u8 = 1;
const RESULT_PLAYER2_WIN: u8 = 2;

public fun create_game(
    wager_coin: Coin<SUI>,
    player2: address,
    commitment: vector<u8>,
    join_timeout_ms: u64,
    clock: &Clock,
    ctx: &mut sui::tx_context::TxContext,
) {
    let wager_amount = sui::coin::value(&wager_coin);
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
        closed: false,
    };

    sui::event::emit(GameCreated {
        game_id: id_copy,
        player1: sui::tx_context::sender(ctx),
        player2,
        wager_amount,
    });

    sui::transfer::share_object(game);
}

public fun join_game(
    game: &mut Game,
    wager_coin: Coin<SUI>,
    player2_choice: u8,
    reveal_timeout_ms: u64,
    clock: &Clock,
    ctx: &mut sui::tx_context::TxContext,
) {
    assert!(game.state == GameState::Waiting, EInvalidState);
    
    // Nếu player2 là 0x0, cho phép bất kỳ ai tham gia. Ngược lại, kiểm tra đúng địa chỉ.
    if (game.player2 != @0x0) {
        assert!(sui::tx_context::sender(ctx) == game.player2, EInvalidPlayer);
    } else {
        game.player2 = sui::tx_context::sender(ctx);
    };

    assert!(is_valid_choice(player2_choice), EInvalidChoice);
    assert!(
        sui::coin::value(&wager_coin) == sui::balance::value(&game.wager),
        EInvalidWagerAmount
    );

    sui::balance::join(&mut game.wager, sui::coin::into_balance(wager_coin));
    game.player2_choice = player2_choice;
    game.state = GameState::Reveal;
    game.timeout_at_ms = sui::clock::timestamp_ms(clock) + reveal_timeout_ms;

    sui::event::emit(GameJoined {
        game_id: sui::object::uid_to_inner(&game.id),
        player2: sui::tx_context::sender(ctx),
    });
}

public fun reveal_and_settle(
    game: Game, // Consuming the object for deletion
    player1_choice: u8,
    salt: vector<u8>,
    ctx: &mut sui::tx_context::TxContext,
) {
    let mut game = game;
    assert!(game.state == GameState::Reveal, EInvalidState);
    assert!(sui::tx_context::sender(ctx) == game.player1, EInvalidPlayer);
    assert!(is_valid_choice(player1_choice), EInvalidChoice);
    assert!(
        game.commitment == make_commitment(player1_choice, &salt),
        EInvalidCommitment
    );

    let player1 = game.player1;
    let player2 = game.player2;
    let player2_choice = game.player2_choice;
    let result = decide_winner(player1_choice, player2_choice);
    
    let winner = if (result == RESULT_DRAW) {
        let half = sui::balance::value(&game.wager) / 2;
        pay_from_game(&mut game, player1, half, ctx);
        pay_all_from_game(&mut game, player2, ctx);
        @0x0 // No single winner
    } else if (result == RESULT_PLAYER1_WIN) {
        pay_all_from_game(&mut game, player1, ctx);
        player1
    } else {
        pay_all_from_game(&mut game, player2, ctx);
        player2
    };

    sui::event::emit(GameSettled {
        game_id: sui::object::uid_to_inner(&game.id),
        winner,
        p1_choice: player1_choice,
        p2_choice: player2_choice,
        result,
    });

    let Game { id, wager, .. } = game;
    sui::balance::destroy_zero(wager);
    sui::object::delete(id);
}

public fun claim_timeout(
    game: Game, // Consuming the object for deletion
    clock: &Clock,
    ctx: &mut sui::tx_context::TxContext,
) {
    let mut game = game;
    assert!(sui::clock::timestamp_ms(clock) >= game.timeout_at_ms, ETimeoutNotReached);
    assert!(game.state != GameState::Finished, EInvalidState);

    let player1 = game.player1;
    let player2 = game.player2;
    let is_waiting_stage = game.state == GameState::Waiting;
    
    let claimer = if (is_waiting_stage) {
        pay_all_from_game(&mut game, player1, ctx);
        player1
    } else {
        pay_all_from_game(&mut game, player2, ctx);
        player2
    };

    sui::event::emit(GameTimedOut {
        game_id: sui::object::uid_to_inner(&game.id),
        claimer,
        is_waiting_stage,
    });

    let Game { id, wager, .. } = game;
    sui::balance::destroy_zero(wager);
    sui::object::delete(id);
}

fun is_valid_choice(choice: u8): bool {
    choice == CHOICE_ROCK || choice == CHOICE_PAPER || choice == CHOICE_SCISSORS
}

fun make_commitment(choice: u8, salt: &vector<u8>): vector<u8> {
    let mut bytes = vector[choice];
    std::vector::append(&mut bytes, *salt);
    sui::hash::blake2b256(&bytes)
}

fun decide_winner(player1_choice: u8, player2_choice: u8): u8 {
    if (player1_choice == player2_choice) {
        RESULT_DRAW
    } else if (
        (player1_choice == CHOICE_ROCK && player2_choice == CHOICE_SCISSORS)
            || (player1_choice == CHOICE_PAPER && player2_choice == CHOICE_ROCK)
            || (player1_choice == CHOICE_SCISSORS && player2_choice == CHOICE_PAPER)
    ) {
        RESULT_PLAYER1_WIN
    } else {
        RESULT_PLAYER2_WIN
    }
}

fun pay_from_game(game: &mut Game, recipient: address, amount: u64, ctx: &mut sui::tx_context::TxContext) {
    let payout_balance = sui::balance::split(&mut game.wager, amount);
    let payout_coin = sui::coin::from_balance(payout_balance, ctx);
    sui::transfer::public_transfer(payout_coin, recipient);
}

fun pay_all_from_game(game: &mut Game, recipient: address, ctx: &mut sui::tx_context::TxContext) {
    let amount = sui::balance::value(&game.wager);
    if (amount > 0) {
        pay_from_game(game, recipient, amount, ctx);
    };
}


#[test_only]
public fun test_decide_winner(player1_choice: u8, player2_choice: u8): u8 {
    decide_winner(player1_choice, player2_choice)
}

