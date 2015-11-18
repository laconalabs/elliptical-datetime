/** @jsx createElement */
import _ from 'lodash'
import {createElement, Phrase} from 'lacona-phrase'
import DateDuration from './date-duration'
import {DigitString, Integer, Ordinal} from 'lacona-phrase-number'
import Month from './month'
import Weekday from './weekday'

export default class DatePhrase extends Phrase {
  getValue (result) {
    if (!result) return

    if (_.isDate(result)) {
      return result
    } else if (result.relative) {
      const date = new Date()
      date.setHours(0, 0, 0, 0)
      if (!_.isUndefined(result.relative.days)) date.setDate(date.getDate() + result.relative.days)
      if (!_.isUndefined(result.relative.weeks)) date.setDate(date.getDate() + (result.relative.weeks * 7))
      if (!_.isUndefined(result.relative.months)) date.setMonth(date.getMonth() + result.relative.months)
      if (!_.isUndefined(result.relative.years)) date.setFullYear(date.getFullYear() + result.relative.years)

      return date
    } else if (result.absolute) {
      return result.absolute
    }
  }
}

DatePhrase.translations = [{
  langs: ['en_US', 'default'],
  describe () {
    return (
      <placeholder text='date'>
        <sequence>
          <literal text='on ' optional={true} prefered={true} limited={true} />
          <choice merge={true}>
            <argument text='date' showForEmpty={true} merge={true} id='relative'>
              <choice>
                <NamedDay allowPast={this.props.allowPast} />
                <RelativeNumbered allowPast={this.props.allowPast} />
                <RelativeAdjacent allowPast={this.props.allowPast} />
              </choice>
            </argument>
            <argument text='date' showForEmpty={true} merge={true} id='absolute'>
              <choice id='absolute'>
                <RelativeWeekday allowPast={this.props.allowPast} />
                <AbsoluteDay allowPast={this.props.allowPast} />
                <NamedMonthAbsolute allowPast={this.props.allowPast} />
              </choice>
            </argument>
            {this.props.allowRecurse ? <RecursiveDay allowPast={this.props.allowPast} /> : null }
          </choice>
        </sequence>
      </placeholder>
    )
  }
}]
DatePhrase.defaultProps = {
  allowRecurse: true,
  allowPast: true
}

class RecursiveDay extends Phrase {
  getValue (result) {
    if (!result || !result.date) return
    let date

    if (result.date === 'now') {
      date = new Date()
      date.setHours(0, 0, 0, 0)
    } else {
      date = new Date(result.date.getTime())
    }

    if (result.years) {
      date.setFullYear((result.years * result.direction) + result.date.getFullYear())
    } else if (result.months) {
      date.setMonth((result.months * result.direction) + result.date.getMonth())
    } else if (result.days) {
      date.setDate((result.days * result.direction) + result.date.getDate())
    }

    return date
  }

  describe () {
    return (
      <sequence>
        <argument text='offset' showForEmpty={true} merge={true}>
          <sequence>
            <DateDuration includeThe={true} merge={true} />
            <list merge={true} id='direction' items={[
                {text: ' before ', value: -1},
                {text: ' after ', value: 1},
                {text: ' from ', value: 1}
              ]} limit={2} />
          </sequence>
        </argument>
        <placeholder text='date' id='date'>
          <choice>
            <literal text='now' value='now' />
            <DatePhrase allowRecurse={false} />
          </choice>
        </placeholder>
      </sequence>
    )
  }
}

class NamedDay extends Phrase {
  describe () {
    return (
      <choice>
        <literal text='today' value={{days: 0}} />
        <literal text='tomorrow' value={{days: 1}} />
        {this.props.allowPast ? <literal text='yesterday' value={{days: -1}} /> : null}
      </choice>
    )
  }
}

class RelativeNumbered extends Phrase {
  getValue (result) {
    if (!result) return

    if (result.direction < 0) {
      return _.mapValues(result.duration, num => -num)
    } else {
      return result.duration
    }
  }

  describe () {
    return (
      <choice>
        <sequence>
          <literal text='in ' id='direction' value={1} />
          <DateDuration id='duration' />
        </sequence>
        {this.props.allowPast ? (
          <sequence>
            <DateDuration id='duration' />
            <literal text=' ago' id='direction' value={-1} />
          </sequence>
        ) : null}
      </choice>
    )
  }
}

class RelativeAdjacent extends Phrase {
  getValue (result) {
    if (!result) return

    return {[result.type]: result.num}
  }

  describe () {
    return (
      <sequence>
        <choice id='num'>
          <literal text='next ' value={1} />
          <literal text='last ' value={-1} />
        </choice>
        <placeholder text='week, month, year' id='type'>
          <choice>
            <literal text='week' value='weeks'/>
            <literal text='month' value='months'/>
            <literal text='year' value='years'/>
          </choice>
        </placeholder>
      </sequence>
    )
  }
}

class RelativeWeekday extends Phrase {
  getValue (result) {
    const returnDate = new Date()
    const currentDay = returnDate.getDay()
    let distance
    if (result.distance != null) {
      distance = result.weekday - currentDay + (7 * result.distance)
    } else {
      distance = (result.weekday + (7 - currentDay)) % 7
    }
    returnDate.setDate(returnDate.getDate() + distance)
    return returnDate
  }

  describe () {
    return (
      <choice>
        <sequence>
          <choice id='distance'>
            <literal text='' value={null} />
            <literal text='last ' value={-1} />
            <literal text='this ' value={0} />
            <list items={['next ', 'this upcoming ']} limit={1} value={1} />
          </choice>
          <placeholder text='weekday' id='weekday'>
            <Weekday />
          </placeholder>
        </sequence>
        <sequence>
          <literal text='the ' />
          <placeholder text='weekday' id='weekday'>
            <Weekday />
          </placeholder>
          <choice id='distance'>
            <literal text=' after next' value={2} />
            <literal text=' after this' value={1} />
            <literal text=' before this' value={-1} />
            <literal text=' before last' value={-2} />
          </choice>
        </sequence>
      </choice>
    )
  }
}

function leapYear (year) {
  return ((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0);
}

class AbsoluteDay extends Phrase {
  getValue (result) {
    let year

    if (result.year) {
      if (result.year.length === 2) {
        const partialYear = parseInt(result.year, 10)
        if (partialYear > 29) {
          year = 1900 + partialYear
        } else {
          year = 2000 + partialYear
        }
      } else {
        year = parseInt(result.year, 10)
      }
    } else {
      year = new Date().getFullYear()
    }

    const month = parseInt(result.month, 10) - 1
    const day = parseInt(result.day, 10)
    return new Date(year, month, day, 0, 0, 0, 0)
  }

  // this is interesting, because the user must be able to specify Feburary 29 if they have not specified a year, and then it must be validated by the year. So use a leap year (2012)
  filter (result) {
    if (_.isUndefined(result) || _.isUndefined(result.month) || _.isUndefined(result.day)) return true

    const year = _.isUndefined(result.year) || _.isEqual(result.year, {}) ? 2012 : parseInt(result.year, 10)
    const month = parseInt(result.month, 10) - 1
    const day = parseInt(result.day, 10)
    const date = new Date(year, month, day, 0, 0, 0, 0)
    return date.getMonth() === month
  }

  describe () {
    return (
      <sequence>
        <DigitString maxLength={2} descriptor='mm' id='month' />
        <list items={['/', '-', '.']} limit={1} />
        <DigitString maxLength={2} max={31} descriptor='dd' id='day' />
        <sequence optional={true} merge={true}>
          <list items={['/', '-', '.']} limit={1} />
          <Year id='year' />
        </sequence>
      </sequence>
    )
  }
}

class Year extends Phrase {
  getValue (result) {
    if (!result) return

    if (result.year20 != null) {
      return 2000 + parseInt(result.year20, 10)
    } else if (result.year19 != null) {
      return 1900 + parseInt(result.year19, 10)
    } else {
      return parseInt(result.year, 10)
    }
  }

  displayWhen (input) {
    return /^(|\d|\d{3})$/.test(input)
  }

  describe () {
    return (
      <argument displayWhen={this.displayWhen} text='year'>
        <choice limit={1}>
          <sequence>
            <decorator text='20' />
            <DigitString minLength={2} maxLength={2} min={0} max={29} id='year20' />
          </sequence>
          <sequence>
            <decorator text='19' />
            <DigitString minLength={2} maxLength={2} min={30} max={99} id='year19' />
          </sequence>
          <DigitString minLength={4} maxLength={4} id='year' />
        </choice>
      </argument>
    )
  }
}

class NamedMonthAbsolute extends Phrase {
  getValue (result) {
    const year = _.isUndefined(result.year) ? new Date().getFullYear() : parseInt(result.year, 10)
    return new Date(year, result.month, result.day, 0, 0, 0, 0)
  }

  // this is interesting, because the user must be able to specify Feburary 29 if they have not specified a year, and then it must be validated by the year. So use a leap year (2012)
  filter (result) {
    if (_.isUndefined(result) || _.isUndefined(result.month) || _.isUndefined(result.day)) return true
    const year = _.isUndefined(result.year) || _.isEqual(result.year, {}) ? 2012 : parseInt(result.year, 10)
    const date = new Date(year, result.month, result.day, 0, 0, 0, 0)
    return date.getMonth() === result.month
  }

  describe () {
    return (
      <choice>
        <sequence>
          <Month id='month' />
          <list items={[' ', ' the ']} limit={1} />
          <choice id='day' limit={1}>
            <Integer max={31} min={1} />
            <Ordinal max={31} />
          </choice>
          <sequence id='year' optional={true} preffered={false}>
            <list items={[', ', ' ']} limit={1} />
            <DigitString descriptor='year' max={9999} allowLeadingZeros={false} merge={true} />
          </sequence>
        </sequence>
        <sequence>
          <literal text='the ' />
          <choice id='day' limit={1}>
            <Integer max={31} min={1} />
            <Ordinal max={31} />
          </choice>
          <list items={[' of ', ' ']} limit={1} />
          <Month id='month' />
          <sequence id='year' optional={true} preffered={false}>
            <list items={[', ', ' ']} limit={1} />
            <DigitString descriptor='year' max={9999} allowLeadingZeros={false} merge={true} />
          </sequence>
        </sequence>
      </choice>
    )
  }
}
