#[test_only]
module contractsb_b_k_prm::contractsb_b_k_prm_tests;
use contractsb_b_k_prm::contractsb_b_k_prm;

#[test]
fun test_winner_draw() {
    assert!(contractsb_b_k_prm::test_decide_winner(0, 0) == 0, 0);
}

#[test]
fun test_winner_player1() {
    assert!(contractsb_b_k_prm::test_decide_winner(0, 2) == 1, 1);
    assert!(contractsb_b_k_prm::test_decide_winner(1, 0) == 1, 2);
    assert!(contractsb_b_k_prm::test_decide_winner(2, 1) == 1, 3);
}

#[test]
fun test_winner_player2() {
    assert!(contractsb_b_k_prm::test_decide_winner(2, 0) == 2, 4);
    assert!(contractsb_b_k_prm::test_decide_winner(0, 1) == 2, 5);
    assert!(contractsb_b_k_prm::test_decide_winner(1, 2) == 2, 6);
}
