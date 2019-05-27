const { BN, expectRevert, expectEvent } = require('openzeppelin-test-helpers');
const { shouldSupportInterfaces } = require('../../introspection/SupportsInterface.behavior');

const ERC1363Receiver = artifacts.require('ERC1363ReceiverMock');
const ERC1363Spender = artifacts.require('ERC1363SpenderMock');

function shouldBehaveLikeERC1363 ([owner, spender, recipient], balance) {
  const value = balance;
  const data = '0x42';

  const RECEIVER_MAGIC_VALUE = '0x88a7ca5c';
  const SPENDER_MAGIC_VALUE = '0x7b04a2d0';

  describe('via transferFromAndCall', function () {
    beforeEach(async function () {
      await this.token.approve(spender, value, { from: owner });
    });

    const transferFromAndCallWithData = function (from, to, value, opts) {
      return this.token.methods['transferFromAndCall(address,address,uint256,bytes)'](
        from, to, value, data, opts
      );
    };

    const transferFromAndCallWithoutData = function (from, to, value, opts) {
      return this.token.methods['transferFromAndCall(address,address,uint256)'](from, to, value, opts);
    };

    const shouldTransferFromSafely = function (transferFun, data) {
      describe('to a valid receiver contract', function () {
        beforeEach(async function () {
          this.receiver = await ERC1363Receiver.new(RECEIVER_MAGIC_VALUE, false);
          this.to = this.receiver.address;
        });

        it('should call onTransferReceived', async function () {
          const receipt = await transferFun.call(this, owner, this.to, value, { from: spender });

          await expectEvent.inTransaction(receipt.tx, ERC1363Receiver, 'Received', {
            operator: spender,
            from: owner,
            value: value,
            data: data,
          });
        });
      });
    };

    const transferFromWasSuccessful = function (sender, spender, balance) {
      let receiver;

      beforeEach(async function () {
        const receiverContract = await ERC1363Receiver.new(RECEIVER_MAGIC_VALUE, false);
        receiver = receiverContract.address;
      });

      describe('when the sender does not have enough balance', function () {
        const amount = balance + 1;

        describe('with data', function () {
          it('reverts', async function () {
            await expectRevert.unspecified(
              transferFromAndCallWithData.call(this, sender, receiver, amount, { from: spender })
            );
          });
        });

        describe('without data', function () {
          it('reverts', async function () {
            await expectRevert.unspecified(
              transferFromAndCallWithoutData.call(this, sender, receiver, amount, { from: spender })
            );
          });
        });
      });

      describe('when the sender has enough balance', function () {
        const amount = balance;
        describe('with data', function () {
          it('transfers the requested amount', async function () {
            await transferFromAndCallWithData.call(this, sender, receiver, amount, { from: spender });

            const senderBalance = await this.token.balanceOf(sender);
            senderBalance.should.be.bignumber.equal(new BN(0));

            const recipientBalance = await this.token.balanceOf(receiver);
            recipientBalance.should.be.bignumber.equal(amount);
          });

          it('emits a transfer event', async function () {
            const { logs } = await transferFromAndCallWithData.call(this, sender, receiver, amount, { from: spender });

            expectEvent.inLogs(logs, 'Transfer', {
              from: sender,
              to: receiver,
              value: amount,
            });
          });
        });

        describe('without data', function () {
          it('transfers the requested amount', async function () {
            await transferFromAndCallWithoutData.call(this, sender, receiver, amount, { from: spender });

            const senderBalance = await this.token.balanceOf(sender);
            senderBalance.should.be.bignumber.equal(new BN(0));

            const recipientBalance = await this.token.balanceOf(receiver);
            recipientBalance.should.be.bignumber.equal(amount);
          });

          it('emits a transfer event', async function () {
            const { logs } = await transferFromAndCallWithoutData.call(
              this, sender, receiver, amount, { from: spender }
            );

            expectEvent.inLogs(logs, 'Transfer', {
              from: sender,
              to: receiver,
              value: amount,
            });
          });
        });
      });
    };

    describe('with data', function () {
      shouldTransferFromSafely(transferFromAndCallWithData, data);
    });

    describe('without data', function () {
      shouldTransferFromSafely(transferFromAndCallWithoutData, null);
    });

    describe('testing ERC20 behaviours', function () {
      transferFromWasSuccessful(owner, spender, value);
    });

    describe('to a receiver that is not a contract', function () {
      it('reverts', async function () {
        await expectRevert.unspecified(
          transferFromAndCallWithoutData.call(this, owner, recipient, value, { from: owner })
        );
      });
    });

    describe('to a receiver contract returning unexpected value', function () {
      it('reverts', async function () {
        const invalidReceiver = await ERC1363Receiver.new(data, false);
        await expectRevert.unspecified(
          transferFromAndCallWithoutData.call(this, owner, invalidReceiver.address, value, { from: spender })
        );
      });
    });

    describe('to a receiver contract that throws', function () {
      it('reverts', async function () {
        const invalidReceiver = await ERC1363Receiver.new(RECEIVER_MAGIC_VALUE, true);
        await expectRevert.unspecified(
          transferFromAndCallWithoutData.call(this, owner, invalidReceiver.address, value, { from: spender })
        );
      });
    });

    describe('to a contract that does not implement the required function', function () {
      it('reverts', async function () {
        const invalidReceiver = this.token;
        await expectRevert.unspecified(
          transferFromAndCallWithoutData.call(this, owner, invalidReceiver.address, value, { from: spender })
        );
      });
    });
  });

  describe('via transferAndCall', function () {
    const transferAndCallWithData = function (to, value, opts) {
      return this.token.methods['transferAndCall(address,uint256,bytes)'](to, value, data, opts);
    };

    const transferAndCallWithoutData = function (to, value, opts) {
      return this.token.methods['transferAndCall(address,uint256)'](to, value, opts);
    };

    const shouldTransferSafely = function (transferFun, data) {
      describe('to a valid receiver contract', function () {
        beforeEach(async function () {
          this.receiver = await ERC1363Receiver.new(RECEIVER_MAGIC_VALUE, false);
          this.to = this.receiver.address;
        });

        it('should call onTransferReceived', async function () {
          const receipt = await transferFun.call(this, this.to, value, { from: owner });

          await expectEvent.inTransaction(receipt.tx, ERC1363Receiver, 'Received', {
            operator: owner,
            from: owner,
            value: value,
            data: data,
          });
        });
      });
    };

    const transferWasSuccessful = function (sender, balance) {
      let receiver;

      beforeEach(async function () {
        const receiverContract = await ERC1363Receiver.new(RECEIVER_MAGIC_VALUE, false);
        receiver = receiverContract.address;
      });

      describe('when the sender does not have enough balance', function () {
        const amount = balance + 1;

        describe('with data', function () {
          it('reverts', async function () {
            await expectRevert.unspecified(transferAndCallWithData.call(this, receiver, amount, { from: sender }));
          });
        });

        describe('without data', function () {
          it('reverts', async function () {
            await expectRevert.unspecified(transferAndCallWithoutData.call(this, receiver, amount, { from: sender }));
          });
        });
      });

      describe('when the sender has enough balance', function () {
        const amount = balance;
        describe('with data', function () {
          it('transfers the requested amount', async function () {
            await transferAndCallWithData.call(this, receiver, amount, { from: sender });

            const senderBalance = await this.token.balanceOf(sender);
            senderBalance.should.be.bignumber.equal(new BN(0));

            const recipientBalance = await this.token.balanceOf(receiver);
            recipientBalance.should.be.bignumber.equal(amount);
          });

          it('emits a transfer event', async function () {
            const { logs } = await transferAndCallWithData.call(this, receiver, amount, { from: sender });

            expectEvent.inLogs(logs, 'Transfer', {
              from: sender,
              to: receiver,
              value: amount,
            });
          });
        });

        describe('without data', function () {
          it('transfers the requested amount', async function () {
            await transferAndCallWithoutData.call(this, receiver, amount, { from: sender });

            const senderBalance = await this.token.balanceOf(sender);
            senderBalance.should.be.bignumber.equal(new BN(0));

            const recipientBalance = await this.token.balanceOf(receiver);
            recipientBalance.should.be.bignumber.equal(amount);
          });

          it('emits a transfer event', async function () {
            const { logs } = await transferAndCallWithoutData.call(this, receiver, amount, { from: sender });

            expectEvent.inLogs(logs, 'Transfer', {
              from: sender,
              to: receiver,
              value: amount,
            });
          });
        });
      });
    };

    describe('with data', function () {
      shouldTransferSafely(transferAndCallWithData, data);
    });

    describe('without data', function () {
      shouldTransferSafely(transferAndCallWithoutData, null);
    });

    describe('testing ERC20 behaviours', function () {
      transferWasSuccessful(owner, value);
    });

    describe('to a receiver that is not a contract', function () {
      it('reverts', async function () {
        await expectRevert.unspecified(
          transferAndCallWithoutData.call(this, recipient, value, { from: owner })
        );
      });
    });

    describe('to a receiver contract returning unexpected value', function () {
      it('reverts', async function () {
        const invalidReceiver = await ERC1363Receiver.new(data, false);
        await expectRevert.unspecified(
          transferAndCallWithoutData.call(this, invalidReceiver.address, value, { from: owner })
        );
      });
    });

    describe('to a receiver contract that throws', function () {
      it('reverts', async function () {
        const invalidReceiver = await ERC1363Receiver.new(RECEIVER_MAGIC_VALUE, true);
        await expectRevert.unspecified(
          transferAndCallWithoutData.call(this, invalidReceiver.address, value, { from: owner })
        );
      });
    });

    describe('to a contract that does not implement the required function', function () {
      it('reverts', async function () {
        const invalidReceiver = this.token;
        await expectRevert.unspecified(
          transferAndCallWithoutData.call(this, invalidReceiver.address, value, { from: owner })
        );
      });
    });
  });

  describe('via approveAndCall', function () {
    const approveAndCallWithData = function (spender, value, opts) {
      return this.token.methods['approveAndCall(address,uint256,bytes)'](spender, value, data, opts);
    };

    const approveAndCallWithoutData = function (spender, value, opts) {
      return this.token.methods['approveAndCall(address,uint256)'](spender, value, opts);
    };

    const shouldApproveSafely = function (approveFun, data) {
      describe('to a valid receiver contract', function () {
        beforeEach(async function () {
          this.spender = await ERC1363Spender.new(SPENDER_MAGIC_VALUE, false);
          this.to = this.spender.address;
        });

        it('should call onApprovalReceived', async function () {
          const receipt = await approveFun.call(this, this.to, value, { from: owner });

          await expectEvent.inTransaction(receipt.tx, ERC1363Spender, 'Approved', {
            owner: owner,
            value: value,
            data: data,
          });
        });
      });
    };

    const approveWasSuccessful = function (sender, amount) {
      let spender;

      beforeEach(async function () {
        const spenderContract = await ERC1363Spender.new(SPENDER_MAGIC_VALUE, false);
        spender = spenderContract.address;
      });

      describe('with data', function () {
        it('approves the requested amount', async function () {
          await approveAndCallWithData.call(this, spender, amount, { from: sender });

          const spenderAllowance = await this.token.allowance(sender, spender);
          spenderAllowance.should.be.bignumber.equal(amount);
        });

        it('emits an approval event', async function () {
          const { logs } = await approveAndCallWithData.call(this, spender, amount, { from: sender });

          expectEvent.inLogs(logs, 'Approval', {
            owner: sender,
            spender: spender,
            value: amount,
          });
        });
      });

      describe('without data', function () {
        it('approves the requested amount', async function () {
          await approveAndCallWithoutData.call(this, spender, amount, { from: sender });

          const spenderAllowance = await this.token.allowance(sender, spender);
          spenderAllowance.should.be.bignumber.equal(amount);
        });

        it('emits an approval event', async function () {
          const { logs } = await approveAndCallWithoutData.call(this, spender, amount, { from: sender });

          expectEvent.inLogs(logs, 'Approval', {
            owner: sender,
            spender: spender,
            value: amount,
          });
        });
      });
    };

    describe('with data', function () {
      shouldApproveSafely(approveAndCallWithData, data);
    });

    describe('without data', function () {
      shouldApproveSafely(approveAndCallWithoutData, null);
    });

    describe('testing ERC20 behaviours', function () {
      approveWasSuccessful(owner, value);
    });

    describe('to a spender that is not a contract', function () {
      it('reverts', async function () {
        await expectRevert.unspecified(
          approveAndCallWithoutData.call(this, recipient, value, { from: owner })
        );
      });
    });

    describe('to a spender contract returning unexpected value', function () {
      it('reverts', async function () {
        const invalidSpender = await ERC1363Spender.new(data, false);
        await expectRevert.unspecified(
          approveAndCallWithoutData.call(this, invalidSpender.address, value, { from: owner })
        );
      });
    });

    describe('to a spender contract that throws', function () {
      it('reverts', async function () {
        const invalidSpender = await ERC1363Spender.new(SPENDER_MAGIC_VALUE, true);
        await expectRevert.unspecified(
          approveAndCallWithoutData.call(this, invalidSpender.address, value, { from: owner })
        );
      });
    });

    describe('to a contract that does not implement the required function', function () {
      it('reverts', async function () {
        const invalidSpender = this.token;
        await expectRevert.unspecified(
          approveAndCallWithoutData.call(this, invalidSpender.address, value, { from: owner })
        );
      });
    });
  });

  shouldSupportInterfaces([
    'ERC1363Transfer',
    'ERC1363Approve',
  ]);
}

module.exports = {
  shouldBehaveLikeERC1363,
};
