import axios from "axios";

const publicUrl = process.env.PUBLIC_URL || `http://localhost:3000`
const apiUrl = process.env.REACT_APP_API_URL || `/api/dashboard`

const get = async (url) => {
    console.log(`Getting ${url}...`)
    const res = await axios.get(`${apiUrl}/${url}`)
    if (res.data && res.data.rows && res.data.rows.length === 0) {
      console.log(`Got zero rows from ${url}`)
      return []
    } else if (res.data && res.data.rows && res.data.rows.length === 1) {
      console.log(`Got one row from ${url}: ${JSON.stringify(res.data.rows[0])}`)
      return res.data.rows[0]
    } else if (res.data && res.data.rows && res.data.rows.length >= 1) {
      console.log(`Got ${res.data.rows.length} rows from ${url}: ${JSON.stringify(res.data.rows)}`)
      return res.data.rows
    } else {
      console.warn(`Couldn't get ${url}: ${JSON.stringify(res)}`)
      return null
    }
}

export default get
