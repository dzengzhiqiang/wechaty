#!/usr/bin/env node
/**
 *   Wechaty - https://github.com/chatie/wechaty
 *
 *   @copyright 2016-2018 Huan LI <zixia@zixia.net>
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */

/**
 *
 * Known ISSUES:
 *  - BUG1: can't find member by this NickName:
 *    ' leaver: 艾静<img class="emoji emojiae" text="_web" src="/zh_CN/htmledition/v2/images/spacer.gif" />JOY
 *  - BUG2: leave event not right: sometimes can not found member (any more, because they left)
 * create a room need at least three people
 * when we create a room, the following one is the 3rd people.
 *
 * put name of one of your friend here, or room create function will not work.
 *
 * ::::::::: ___CHANGE ME___ :::::::::
 *                           vvvvvvvvv
 *                           vvvvvvvvv
 *                           vvvvvvvvv
 */
const HELPER_CONTACT_NAME = 'Bruce LEE'

/**
 *                           ^^^^^^^^^
 *                           ^^^^^^^^^
 *                           ^^^^^^^^^
 * ::::::::: ___CHANGE ME___ :::::::::
 *
 */

/* tslint:disable:variable-name */
const qrcodeTerminal = require('qrcode-terminal')

/**
 * Change `import { ... } from '../'`
 * to     `import { ... } from 'wechaty'`
 * when you are runing with Docker or NPM instead of Git Source.
 */
import {
  config,
  Contact,
  Room,
  Wechaty,
  log,
}             from '../src/'

const welcome = `
=============== Powered by Wechaty ===============
-------- https://github.com/Chatie/wechaty --------

Hello,

I'm a Wechaty Botie with the following super powers:

1. Find a room
2. Add people to room
3. Del people from room
4. Change room topic
5. Monitor room events
6. etc...

If you send a message of magic word 'ding',
you will get a invitation to join my own room!
__________________________________________________

Hope you like it, and you are very welcome to
upgrade me for more super powers!

Please wait... I'm trying to login in...

`
console.log(welcome)
const bot = Wechaty.instance({ profile: config.default.DEFAULT_PROFILE })

bot
.on('scan', (url, code) => {
  if (!/201|200/.test(String(code))) {
    const loginUrl = url.replace(/\/qrcode\//, '/l/')
    qrcodeTerminal.generate(loginUrl)
  }
  console.log(`${url}\n[${code}] Scan QR Code in above url to login: `)
})
.on('logout'	, user => log.info('Bot', `${user.name()} logouted`))
.on('error'   , e => log.info('Bot', 'error: %s', e))

/**
 * Global Event: login
 *
 * do initialization inside this event.
 * (better to set a timeout, for browser need time to download other data)
 */
.on('login', async function(this, user) {
  let msg = `${user.name()} logined`

  log.info('Bot', msg)
  await this.say(msg)

  msg = `setting to manageDingRoom() after 3 seconds ... `
  log.info('Bot', msg)
  await this.say(msg)

  setTimeout(manageDingRoom.bind(this), 3000)
})

/**
 * Global Event: room-join
 */
.on('room-join', async function(room, inviteeList, inviter) {
  log.info( 'Bot', 'EVENT: room-join - Room %s got new member %s, invited by %s',
            await room.topic(),
            inviteeList.map(c => c.name()).join(','),
            inviter.name(),
          )
  const topic = await room.topic()
  room.say(`welcome to ${topic}!`, inviteeList[0])
})

/**
 * Global Event: room-leave
 */
.on('room-leave', async function(room, leaverList) {
  log.info('Bot', 'EVENT: room-leave - Room %s lost member %s',
                  await room.topic(),
                  leaverList.map(c => c.name()).join(','),
              )
  const topic = await room.topic()
  const name  = leaverList[0] ? leaverList[0].name() : 'no contact!'
  room.say(`kick off ${name} from ${topic}!` )
})

/**
 * Global Event: room-topic
 */
.on('room-topic', function(room, topic, oldTopic, changer) {
  try {
    log.info('Bot', 'EVENT: room-topic - Room %s change topic from %s to %s by member %s',
                    room,
                    oldTopic,
                    topic,
                    changer,
                )
    room.say(`room-topic - change topic from ${oldTopic} to ${topic} by member ${changer.name()}` )
  } catch (e) {
    log.error('Bot', 'room-topic event exception: %s', e.stack)
  }
})

/**
 * Global Event: message
 */
.on('message', async function(this: Wechaty, message) {
  const room    = message.room()
  const sender  = message.from()
  const content = message.text()

  if (!sender) {
    return
  }

  console.log((room ? '[' + await room.topic() + ']' : '')
              + '<' + sender.name() + '>'
              + ':' + message,
  )

  if (message.self()) {
    return // skip self
  }
  /**
   * `ding` will be the magic(toggle) word:
   *  1. say ding first time, will got a room invitation
   *  2. say ding in room, will be removed out
   */
  if (/^ding$/i.test(content)) {

    /**
     *  in-room message
     */
    if (room) {
      if (/^ding/i.test(await room.topic())) {
        /**
         * move contact out of room
         */
        getOutRoom(sender, room)
      }

    /**
     * peer to peer message
     */
    } else {

      /**
       * find room name start with "ding"
       */
      try {
        const dingRoom = await this.Room.find({ topic: /^ding/i })
        if (dingRoom) {
          /**
           * room found
           */
          log.info('Bot', 'onMessage: got dingRoom: %s', dingRoom.topic())

          if (dingRoom.has(sender)) {
            /**
             * speaker is already in room
             */
            log.info('Bot', 'onMessage: sender has already in dingRoom')
            sender.say('no need to ding again, because you are already in ding room')
            // sendMessage({
            //   content: 'no need to ding again, because you are already in ding room'
            //   , to: sender
            // })

          } else {
            /**
             * put speaker into room
             */
            log.info('Bot', 'onMessage: add sender(%s) to dingRoom(%s)', sender.name(), dingRoom.topic())
            sender.say('ok, I will put you in ding room!')
            putInRoom(sender, dingRoom)
          }

        } else {
          /**
           * room not found
           */
          log.info('Bot', 'onMessage: dingRoom not found, try to create one')
          /**
           * create the ding room
           */
          await createDingRoom(sender)
          /**
           * listen events from ding room
           */
          manageDingRoom()
        }
      } catch (e) {
        log.error(e)
      }
    }
  }
})
.start()
.catch(e => console.error(e))

async function manageDingRoom() {
  log.info('Bot', 'manageDingRoom()')

  /**
   * Find Room
   */
  try {
    const room = await bot.Room.find({ topic: /^ding/i })
    if (!room) {
      log.warn('Bot', 'there is no room topic ding(yet)')
      return
    }
    log.info('Bot', 'start monitor "ding" room join/leave event')

    /**
     * Event: Join
     */
    room.on('join', function(inviteeList, inviter) {
      log.verbose('Bot', 'Room EVENT: join - %s, %s',
                         inviteeList.map(c => c.name()).join(', '),
                         inviter.name(),
      )
      checkRoomJoin.call(this, room, inviteeList, inviter)
    })

    /**
     * Event: Leave
     */
    room.on('leave', (leaverList, remover) => {
      log.info('Bot', 'Room EVENT: leave - %s leave(remover %s), byebye', leaverList.join(','), remover || 'unknown')
    })

    /**
     * Event: Topic Change
     */
    room.on('topic', (topic, oldTopic, changer) => {
      log.info('Bot', 'Room EVENT: topic - changed from %s to %s by member %s',
            oldTopic,
            topic,
            changer.name(),
        )
    })
  } catch (e) {
    log.warn('Bot', 'Room.find rejected: %s', e.stack)
  }
}

async function checkRoomJoin(room: Room, inviteeList: Contact[], inviter: Contact) {
  log.info('Bot', 'checkRoomJoin(%s, %s, %s)',
                  await room.topic(),
                  inviteeList.map(c => c.name()).join(','),
                  inviter.name(),
          )

  try {
    // let to, content
    const userSelf = bot.userSelf()

    if (inviter.id !== userSelf.id) {

      await room.say('RULE1: Invitation is limited to me, the owner only. Please do not invit people without notify me.',
                      inviter,
                    )
      await room.say('Please contact me: by send "ding" to me, I will re-send you a invitation. Now I will remove you out, sorry.',
                      inviteeList,
                    )

      await room.topic('ding - warn ' + inviter.name())
      setTimeout(
        _ => inviteeList.forEach(c => room.del(c)),
        10 * 1000,
      )

    } else {

      await room.say('Welcome to my room! :)')

      let welcomeTopic
      welcomeTopic = inviteeList.map(c => c.name()).join(', ')
      await room.topic('ding - welcome ' + welcomeTopic)
    }

  } catch (e) {
    log.error('Bot', 'checkRoomJoin() exception: %s', e.stack)
  }

}

async function putInRoom(contact: Contact, room: Room) {
  log.info('Bot', 'putInRoom(%s, %s)', contact.name(), await room.topic())

  try {
    await room.add(contact)
    setTimeout(
      _ => room.say('Welcome ', contact),
      10 * 1000,
    )
  } catch (e) {
    log.error('Bot', 'putInRoom() exception: ' + e.stack)
  }
}

async function getOutRoom(contact: Contact, room: Room) {
  log.info('Bot', 'getOutRoom(%s, %s)', contact, room)

  try {
    await room.say('You said "ding" in my room, I will remove you out.')
    await room.del(contact)
  } catch (e) {
    log.error('Bot', 'getOutRoom() exception: ' + e.stack)
  }
}

function getHelperContact() {
  log.info('Bot', 'getHelperContact()')

  // create a new room at least need 3 contacts
  return bot.Contact.find({ name: HELPER_CONTACT_NAME })
}

async function createDingRoom(contact: Contact): Promise<any> {
  log.info('Bot', 'createDingRoom(%s)', contact)

  try {
    const helperContact = await getHelperContact()

    if (!helperContact) {
      log.warn('Bot', 'getHelperContact() found nobody')
      contact.say(`You don't have a friend called ${HELPER_CONTACT_NAME}, because create a new room at least need 3 contacts, please set [HELPER_CONTACT_NAME] in the code first!`)
      return
    }

    log.info('Bot', 'getHelperContact() ok. got: %s', helperContact.name())

    const contactList = [contact, helperContact]
    log.verbose('Bot', 'contactList: %s', contactList.join(','))

    const room = await bot.Room.create(contactList, 'ding')
    log.info('Bot', 'createDingRoom() new ding room created: %s', room)

    await room.topic('ding - created')
    await room.say('ding - created')

    return room

  } catch (e) {
    log.error('Bot', 'getHelperContact() exception:', e.stack)
    throw e
  }
}
